// Golden Fleece — Headless Core
// The brain before the body.

export {
  // Layer 1: Rosetta Stone
  type WLESCategory,
  type RippleValence,
  type BlockFormat,
  type WorldNode,
  type WorldGraph,
  createNode,
  createGraph,
  addNode,
  connectNodes,
  nodesByCategory,
  detectBlockFormat,
  serializeGraph,
  deserializeGraph,
} from './worldnode.js'

export {
  // Layer 2: Compiler
  type CompilationResult,
  type OperatorDef,
  extractWorldText,
  extractFreeform,
  compileExtraction,
  compile,
  compileWithLLM,
  OPERATORS,
} from './compiler.js'

export {
  // Layer 3: Headless Layout
  type LayoutConfig,
  layoutGraph,
  assignZones,
} from './layout.js'
