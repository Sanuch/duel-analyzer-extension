export const localResources = {
  selectors: {
    stepContainer: "#steps",
    stepItem: ".step"
  },
  patterns: {
    voice: [/\b(молв|voice|pray|говор)/i],
    influence: [/\b(влияни|influence|attack|heal)/i],
    miracle: [/\b(чудо|miracle)/i],
    empty: [/\b(пусто|ничего|empty|miss)/i]
  }
};
