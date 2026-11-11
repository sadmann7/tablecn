import { commentStyle, noLowValueComments } from "./comment-style.ts";
import { topDownOrder } from "./top-down-order.ts";

export default {
  meta: { name: "tablecn" },
  rules: {
    "comment-style": commentStyle,
    "no-low-value-comments": noLowValueComments,
    "top-down-order": topDownOrder,
  },
};
