import { commentStyle } from "./comment-style.ts";
import { topDownOrder } from "./top-down-order.ts";

export default {
  meta: { name: "tablecn" },
  rules: {
    "comment-style": commentStyle,
    "top-down-order": topDownOrder,
  },
};
