import { evaluateAgentReadiness } from '../../src/score.js'

declare global {
  interface Window {
    __polyformAgentReadinessScan?: typeof evaluateAgentReadiness
  }
}

window.__polyformAgentReadinessScan = evaluateAgentReadiness
