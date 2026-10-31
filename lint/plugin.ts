interface Node {
  type: string;
  range: [number, number];
  parent?: Node | null;
  id?: Node | null;
  name?: string | Node;
  object?: Node;
  key?: Node;
  value?: Node | null;
  computed?: boolean;
  declaration?: Node | null;
  declarations?: Node[];
  init?: Node | null;
  specifiers?: { local: Node }[];
}

interface Fix {
  range: [number, number];
  text: string;
}

interface Context {
  sourceCode: {
    text: string;
    ast: { body: Node[] };
    getCommentsBefore: (node: Node) => { range: [number, number] }[];
  };
  report: (diagnostic: {
    node: Node;
    message: string;
    fix?: () => Fix;
  }) => void;
}

interface Unit {
  start: number;
  end: number;
  separator: string;
  statements: Node[];
  isExported: boolean;
  isType: boolean;
  helper?: string;
  stateNames?: string[];
}

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);
const TYPE_TYPES = new Set([
  "TSInterfaceDeclaration",
  "TSTypeAliasDeclaration",
]);
const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/;

const helpersBelowFirstUse = {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: {
      description:
        "Keeps files top-down: private functions sit below the code that first uses them, after the run of exports they serve, with the module state only they use. Helpers several declarations share go after the last one, and types and constants stay above their first use",
    },
  },
  create(context: Context) {
    const { body } = context.sourceCode.ast;
    const exported = getExportedNames(body);
    const helpers = new Map<string, Node>();
    const declaredNames = new Set<string>();
    for (const statement of body) {
      const name = getHelperName(statement);
      if (name && !exported.has(name)) helpers.set(name, statement);
      for (const stateName of getStateNames(statement) ?? []) {
        if (!exported.has(stateName)) declaredNames.add(stateName);
      }
      for (const hoistedName of getHoistedNames(statement)) {
        declaredNames.add(hoistedName);
      }
    }
    const references = new Map<string, Node[]>();

    function onIdentifier(node: Node) {
      const { name } = node;
      if (typeof name !== "string") return;
      if (!helpers.has(name) && !declaredNames.has(name)) return;
      if (!getIsReference(node)) return;
      const helper = helpers.get(name);
      if (helper && getIsInside(node, helper)) return;
      const list = references.get(name) ?? [];
      list.push(node);
      references.set(name, list);
    }

    return {
      Identifier: onIdentifier,
      JSXIdentifier: onIdentifier,
      "Program:exit"() {
        const layout = getLayout(context, helpers, references);
        const fix = () => getReorderFix(context, layout);

        for (const unit of getMisplaced(layout.units, layout)) {
          const node = unit.statements.at(-1);
          if (!node) continue;
          const owner = layout.owners.get(unit);
          context.report({
            node,
            message: !owner
              ? layout.shared.has(unit)
                ? `Move \`${unit.helper ?? ""}\` below its last use, since several declarations share it.`
                : `Move \`${unit.helper ?? ""}\` below its first use.`
              : layout.hoisted.has(unit)
                ? `Move \`${getUnitName(unit)}\` above \`${getUnitName(owner)}\`, its first use.`
                : unit.isType
                  ? `Move \`${getDeclaredTypeName(unit)}\` right above \`${getDeclaredNames(owner)[0] ?? ""}\`, which it types.`
                  : `Move \`${unit.stateNames?.join("`, `")}\` right above \`${owner.helper}\`, the only code using it.`,
            fix,
          });
        }
      },
    };
  },
};

interface Layout {
  units: Unit[];
  // Where each helper must come after: its first user, or the end of the run of
  // exports that user is in
  anchors: Map<Unit, Unit>;
  // The helper that alone uses a unit of module state, or the first user of a
  // type or constant declared below it
  owners: Map<Unit, Unit>;
  hoisted: Set<Unit>;
  // Helpers several declarations use, placed after the last one
  shared: Set<Unit>;
  // The whole file in top-down order
  order: Unit[];
}

type Rules = Omit<Layout, "order">;

function getLayout(
  context: Context,
  helpers: Map<string, Node>,
  references: Map<string, Node[]>,
): Layout {
  const units = getUnits(context, helpers);
  const unitOf = new Map<Node, Unit>();
  const helperUnits = new Map<string, Unit>();
  for (const unit of units) {
    for (const statement of unit.statements) unitOf.set(statement, unit);
    if (unit.helper) helperUnits.set(unit.helper, unit);
  }
  const getUser = (node: Node) => unitOf.get(getTopLevelStatement(node));

  const firstUses = new Map<Unit, Node>();
  for (const [name, unit] of helperUnits) {
    const list = references.get(name) ?? [];
    const first = list.reduce<Node | undefined>(
      (earliest, node) =>
        !earliest || node.range[0] < earliest.range[0] ? node : earliest,
      undefined,
    );
    if (first) firstUses.set(unit, first);
  }

  // Helpers that run while the module loads keep their state above them
  const eager = new Set<Unit>();
  const queue: Unit[] = [];
  for (const [name, unit] of helperUnits) {
    const list = references.get(name) ?? [];
    if (list.some((node) => !getIsInsideFunction(node))) {
      eager.add(unit);
      queue.push(unit);
    }
  }
  for (let unit = queue.shift(); unit; unit = queue.shift()) {
    for (const [name, other] of helperUnits) {
      if (eager.has(other)) continue;
      const list = references.get(name) ?? [];
      if (list.some((node) => getUser(node) === unit)) {
        eager.add(other);
        queue.push(other);
      }
    }
  }

  const owners = new Map<Unit, Unit>();
  for (const unit of units) {
    if (!unit.stateNames) continue;
    let owner: Unit | undefined;
    let isOwned = true;
    for (const name of unit.stateNames) {
      for (const node of references.get(name) ?? []) {
        const user = getUser(node);
        if (!user?.helper || (owner && owner !== user)) isOwned = false;
        owner = user;
      }
    }
    if (isOwned && owner?.helper && !eager.has(owner)) owners.set(unit, owner);
  }
  // A props type that drifted away from its component goes back above it, or
  // above the memo wrapping it
  const declarers = new Map<string, Unit>();
  for (const unit of units) {
    for (const name of getDeclaredNames(unit)) declarers.set(name, unit);
  }
  for (const unit of units) {
    const name = unit.statements[0]?.id?.name;
    if (!unit.isType || unit.isExported || typeof name !== "string") continue;
    if (!name.endsWith("Props")) continue;
    const component = name.slice(0, -"Props".length);
    const wrapper =
      declarers.get(component) ??
      declarers.get(
        `${component.charAt(0).toLowerCase()}${component.slice(1)}`,
      );
    const impl = declarers.get(`${component}Impl`);
    const candidates = [wrapper, impl].filter((item) => item !== undefined);
    const isShared = (references.get(name) ?? []).some((node) => {
      const user = getUser(node);
      return !user || !candidates.includes(user);
    });
    if (isShared || candidates.length === 0) continue;
    // Either spot reads fine, so the one it already sits above wins
    const next = units[units.indexOf(unit) + 1];
    const owner = candidates.find((item) => item === next) ?? candidates[0];
    if (owner && owner !== unit) owners.set(unit, owner);
  }

  // A type or constant declared below its first use moves above it. A use from
  // another moving declaration counts from where that one lands
  const hoisted = getHoisted(units, owners, references, getUser);
  for (const [unit, user] of hoisted) owners.set(unit, user);

  // A helper shared by several declarations goes after the last one's section
  const lastUsers = new Map<Unit, Unit>();
  for (const unit of units) {
    const users = new Set<Unit>();
    for (const node of references.get(unit.helper ?? "") ?? []) {
      const user = getUser(node);
      if (user && user !== unit && !user.helper) users.add(user);
    }
    if (users.size < 2) continue;
    const last = [...users].reduce((latest, user) =>
      units.indexOf(user) > units.indexOf(latest) ? user : latest,
    );
    lastUsers.set(unit, last);
  }

  const anchors = new Map<Unit, Unit>();
  for (const unit of units) {
    const firstUse = firstUses.get(unit);
    const first = firstUse && getUser(firstUse);
    if (!first || first === unit) continue;
    const last = lastUsers.get(unit);
    const user = last ?? first;
    anchors.set(
      unit,
      user.isExported
        ? getRunEnd(units, user, owners)
        : last
          ? getSectionEnd(units, user, owners, lastUsers)
          : user,
    );
  }

  const layout = {
    units,
    anchors,
    owners,
    hoisted: new Set(hoisted.keys()),
    shared: new Set(lastUsers.keys()),
  };
  return { ...layout, order: getOrder(layout, firstUses) };
}

function getHoisted(
  units: Unit[],
  owners: Map<Unit, Unit>,
  references: Map<string, Node[]>,
  getUser: (node: Node) => Unit | undefined,
) {
  const hoisted = new Map<Unit, Unit>();
  const getPosition = (unit: Unit, seen = new Set<Unit>()): number => {
    const target = hoisted.get(unit);
    if (!target || seen.has(unit)) return units.indexOf(unit);
    seen.add(unit);
    return getPosition(target, seen) - 0.5;
  };
  const candidates = units.filter(
    (unit) => !owners.has(unit) && getIsDeclaration(unit),
  );
  for (let pass = 0; pass < units.length; pass++) {
    let isChanged = false;
    for (const unit of candidates) {
      const statement = unit.statements[0];
      if (!statement) continue;
      const index = units.indexOf(unit);
      let first: Unit | undefined;
      for (const name of getHoistedNames(statement)) {
        for (const node of references.get(name) ?? []) {
          const user = getUser(node);
          if (!user || user === unit) continue;
          if (!first || getPosition(user) < getPosition(first)) first = user;
        }
      }
      const target =
        first &&
        getPosition(first) < index &&
        !getIsReadingBetween(units, unit, first)
          ? first
          : undefined;
      if (target === hoisted.get(unit)) continue;
      if (target) hoisted.set(unit, target);
      else hoisted.delete(unit);
      isChanged = true;
    }
    if (!isChanged) break;
  }
  return hoisted;
}

// A constant can't move above declarations its own value reads
function getIsReadingBetween(units: Unit[], unit: Unit, target: Unit) {
  if (unit.isType) return false;
  const statement = unit.statements[0];
  if (!statement) return false;
  const start = Math.max(0, units.indexOf(target));
  const names = units
    .slice(start, units.indexOf(unit))
    .flatMap((other) => [
      ...getDeclaredNames(other),
      ...(other.statements[0] ? getHoistedNames(other.statements[0]) : []),
    ]);
  const read = new Set<string>();
  for (const declarator of statement.declarations ?? []) {
    if (declarator.init) collectIdentifiers(declarator.init, read);
  }
  return names.some((name) => read.has(name));
}

function collectIdentifiers(node: Node, names: Set<string>) {
  if (node.type === "Identifier" && typeof node.name === "string") {
    names.add(node.name);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child === "object" && "type" in child) {
        collectIdentifiers(child as Node, names);
      }
    }
  }
}

// Moves only what breaks the order, and then whatever that move strands, so a
// fix leaves the rest of the file as it was
function getOrder(rules: Rules, firstUses: Map<Unit, Node>) {
  const movable = new Set<Unit>();
  let order = rules.units;
  for (let pass = 0; pass <= rules.units.length; pass++) {
    const misplaced = getMisplaced(order, rules).filter(
      (unit) => !movable.has(unit),
    );
    if (misplaced.length === 0) break;
    for (const unit of misplaced) movable.add(unit);
    order = getPlacedOrder(rules, firstUses, movable);
  }
  return order;
}

function getMisplaced(order: Unit[], rules: Rules) {
  const { anchors, owners, hoisted } = rules;
  return order.filter((unit) => {
    const anchor = anchors.get(unit);
    if (anchor) return order.indexOf(unit) < order.indexOf(anchor);
    const owner = owners.get(unit);
    if (!owner) return false;
    if (hoisted.has(unit)) return order.indexOf(unit) > order.indexOf(owner);
    return !getIsRightAbove(order, owners, unit, owner);
  });
}

function getPlacedOrder(
  rules: Rules,
  firstUses: Map<Unit, Node>,
  movable: Set<Unit>,
) {
  const { units, anchors, owners } = rules;
  const children = new Map<Unit, Unit[]>();
  const states = new Map<Unit, Unit[]>();
  for (const [unit, anchor] of anchors) {
    if (!movable.has(unit)) continue;
    const list = children.get(anchor) ?? [];
    list.push(unit);
    children.set(anchor, list);
  }
  for (const list of children.values()) {
    list.sort(
      (a, b) =>
        (firstUses.get(a)?.range[0] ?? 0) - (firstUses.get(b)?.range[0] ?? 0),
    );
  }
  for (const [state, owner] of owners) {
    if (!movable.has(state)) continue;
    const list = states.get(owner) ?? [];
    list.push(state);
    states.set(owner, list);
  }

  let order: Unit[] = [];
  for (;;) {
    order = [];
    const placed = new Set<Unit>();
    const placeState = (state: Unit) => {
      if (placed.has(state)) return;
      placed.add(state);
      for (const other of states.get(state) ?? []) placeState(other);
      order.push(state);
    };
    const place = (unit: Unit) => {
      if (placed.has(unit)) return;
      placed.add(unit);
      for (const state of states.get(unit) ?? []) placeState(state);
      order.push(unit);
      for (const child of children.get(unit) ?? []) place(child);
    };
    for (const unit of units) {
      if (!movable.has(unit)) place(unit);
    }
    // Helpers that only use each other stay where they are
    const stranded = units.filter((unit) => !placed.has(unit));
    if (stranded.length === 0) break;
    for (const unit of stranded) {
      movable.delete(unit);
      anchors.delete(unit);
    }
  }
  return order;
}

// The last export in the run of exports and types that starts at `user`,
// passing over the helpers and state that will move out of it
function getRunEnd(units: Unit[], user: Unit, owners: Map<Unit, Unit>) {
  let end = user;
  for (let index = units.indexOf(user) + 1; index < units.length; index++) {
    const unit = units[index];
    if (!unit) break;
    if (unit.helper || owners.has(unit) || unit.isType) {
      if (unit.isExported) end = unit;
      continue;
    }
    if (!unit.isExported) break;
    end = unit;
  }
  return end;
}

// The last helper or state that follows `user`, before the next declaration,
// passing over the shared helpers that go after it
function getSectionEnd(
  units: Unit[],
  user: Unit,
  owners: Map<Unit, Unit>,
  lastUsers: Map<Unit, Unit>,
) {
  let end = user;
  for (let index = units.indexOf(user) + 1; index < units.length; index++) {
    const unit = units[index];
    if (!unit || unit.isExported || (!unit.helper && !owners.has(unit))) break;
    if (lastUsers.has(unit) || getIsOwnedByShared(owners, unit, lastUsers)) {
      continue;
    }
    end = unit;
  }
  return end;
}

function getIsOwnedByShared(
  owners: Map<Unit, Unit>,
  unit: Unit,
  lastUsers: Map<Unit, Unit>,
) {
  const owner = owners.get(unit);
  return owner !== undefined && lastUsers.has(owner);
}

function getIsRightAbove(
  order: Unit[],
  owners: Map<Unit, Unit>,
  state: Unit,
  owner: Unit,
) {
  for (let index = order.indexOf(state) + 1; index < order.length; index++) {
    const unit = order[index];
    if (unit === owner) return true;
    if (!unit) return false;
    if (!getIsOwnedBy(owners, unit, owner) && !getIsDeclaration(unit)) {
      return false;
    }
  }
  return false;
}

// Types and constants can sit between state and its helper
function getIsDeclaration(unit: Unit) {
  const statement = unit.statements[0];
  return (
    !unit.isExported &&
    unit.statements.length === 1 &&
    statement !== undefined &&
    getHoistedNames(statement).length > 0
  );
}

// Through a chain, like a type above the constant it types
function getIsOwnedBy(owners: Map<Unit, Unit>, unit: Unit, owner: Unit) {
  const seen = new Set<Unit>();
  for (let next = owners.get(unit); next; next = owners.get(next)) {
    if (next === owner) return true;
    if (seen.has(next)) return false;
    seen.add(next);
  }
  return false;
}

// Rebuilds the file in its top-down order, so one fix settles the whole file
function getReorderFix(context: Context, layout: Layout): Fix {
  const { text } = context.sourceCode;
  const { units, order } = layout;

  const first = units[0];
  const last = units.at(-1);
  if (!first || !last) return { range: [0, 0], text: "" };
  const rebuilt = order
    .map((unit, index) => {
      const chunk = text.slice(unit.start, unit.end);
      if (index === 0) return chunk;
      const previous = units[units.indexOf(unit) - 1];
      const separator = previous === order[index - 1] ? unit.separator : "\n\n";
      return `${separator}${chunk}`;
    })
    .join("");

  return { range: [first.start, last.end], text: rebuilt };
}

// Pairs each helper with its comments and a props interface right above it
function getUnits(context: Context, helpers: Map<string, Node>) {
  const { text, ast } = context.sourceCode;
  const { body } = ast;
  const units: Unit[] = [];
  let previousEnd = body[0]?.range[0] ?? 0;
  for (let index = 0; index < body.length; index++) {
    const statement = body[index];
    if (!statement) continue;
    const next = body[index + 1];
    const nextHelper = getHelperName(next);
    const isProps =
      next !== undefined &&
      nextHelper !== undefined &&
      helpers.has(nextHelper) &&
      getIsPropsOf(statement, nextHelper);
    const statements = isProps && next ? [statement, next] : [statement];
    const helper = isProps ? nextHelper : getHelperName(statement);
    const end = getTrailingEnd(text, (statements.at(-1) ?? statement).range[1]);
    const start = getLeadingStart(context, statement, previousEnd);
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    units.push({
      start,
      end,
      separator: text.slice(previousEnd, start),
      statements,
      isExported: statement.type.startsWith("Export"),
      isType: !isProps && TYPE_TYPES.has(declaration?.type ?? ""),
      helper: helper && helpers.has(helper) ? helper : undefined,
      stateNames: getStateNames(statement),
    });
    previousEnd = end;
    index += statements.length - 1;
  }
  return units;
}

function getUnitName(unit: Unit) {
  return unit.helper ?? getDeclaredNames(unit)[0] ?? getDeclaredTypeName(unit);
}

// Types and SCREAMING_CASE constants that aren't exported
function getHoistedNames(statement: Node) {
  if (TYPE_TYPES.has(statement.type)) {
    const name = statement.id?.name;
    return typeof name === "string" ? [name] : [];
  }
  if (statement.type !== "VariableDeclaration") return [];
  const names: string[] = [];
  for (const declarator of statement.declarations ?? []) {
    const name = declarator.id?.type === "Identifier" ? declarator.id.name : "";
    if (typeof name !== "string" || !CONSTANT_NAME.test(name)) return [];
    names.push(name);
  }
  return names;
}

function getDeclaredTypeName(unit: Unit) {
  const name = unit.statements[0]?.id?.name;
  return typeof name === "string" ? name : "";
}

function getDeclaredNames(unit: Unit) {
  const names: string[] = [];
  for (const statement of unit.statements) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (!declaration || TYPE_TYPES.has(declaration.type)) continue;
    const id = declaration.id?.name;
    if (typeof id === "string") names.push(id);
    for (const declarator of declaration.declarations ?? []) {
      const name = declarator.id?.name;
      if (typeof name === "string") names.push(name);
    }
  }
  return names;
}

function getExportedNames(body: Node[]) {
  const names = new Set<string>();
  for (const statement of body) {
    for (const specifier of statement.specifiers ?? []) {
      if (typeof specifier.local.name === "string") {
        names.add(specifier.local.name);
      }
    }
    const { declaration } = statement;
    if (
      statement.type === "ExportDefaultDeclaration" &&
      declaration?.type === "Identifier" &&
      typeof declaration.name === "string"
    ) {
      names.add(declaration.name);
    }
  }
  return names;
}

function getHelperName(statement: Node | undefined) {
  if (statement?.type !== "FunctionDeclaration") return undefined;
  const name = statement.id?.name;
  return typeof name === "string" ? name : undefined;
}

// Module state is a declaration that isn't a SCREAMING_CASE constant
function getStateNames(statement: Node) {
  if (statement.type !== "VariableDeclaration") return undefined;
  const names: string[] = [];
  for (const declarator of statement.declarations ?? []) {
    const name = declarator.id?.type === "Identifier" ? declarator.id.name : "";
    if (typeof name !== "string" || !name || CONSTANT_NAME.test(name)) {
      return undefined;
    }
    names.push(name);
  }
  return names.length > 0 ? names : undefined;
}

function getIsPropsOf(statement: Node, name: string) {
  return (
    TYPE_TYPES.has(statement.type) &&
    statement.id?.name ===
      `${name.charAt(0).toUpperCase()}${name.slice(1)}Props`
  );
}

function getIsReference(node: Node) {
  const { parent } = node;
  if (!parent) return true;
  switch (parent.type) {
    case "MemberExpression":
    case "JSXMemberExpression":
      return parent.object === node || Boolean(parent.computed);
    case "Property":
      return parent.value === node || Boolean(parent.computed);
    case "MethodDefinition":
    case "PropertyDefinition":
    case "TSPropertySignature":
    case "TSMethodSignature":
      return parent.key !== node || Boolean(parent.computed);
    case "JSXAttribute":
      return parent.name !== node;
    default:
      return parent.id !== node;
  }
}

function getIsInside(node: Node, container: Node) {
  return (
    node.range[0] >= container.range[0] && node.range[1] <= container.range[1]
  );
}

function getIsInsideFunction(node: Node) {
  for (let current = node.parent; current; current = current.parent) {
    if (FUNCTION_TYPES.has(current.type)) return true;
  }
  return false;
}

function getTopLevelStatement(node: Node) {
  let current = node;
  while (current.parent && current.parent.type !== "Program") {
    current = current.parent;
  }
  return current;
}

// A comment on the statement's last line belongs to it
function getTrailingEnd(text: string, end: number) {
  const match = /^[ \t]*(\/\/[^\n]*|\/\*[^\n]*?\*\/)/.exec(text.slice(end));
  return match ? end + match[0].length : end;
}

// Comments on their own lines above a statement belong to it
function getLeadingStart(
  context: Context,
  statement: Node,
  previousEnd: number,
) {
  const { text } = context.sourceCode;
  for (const comment of context.sourceCode.getCommentsBefore(statement)) {
    const [start] = comment.range;
    if (start >= previousEnd && text.slice(previousEnd, start).includes("\n")) {
      return start;
    }
  }
  return statement.range[0];
}

export default {
  meta: { name: "tablecn" },
  rules: { "helpers-below-first-use": helpersBelowFirstUse },
};
