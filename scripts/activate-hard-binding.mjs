import { setHardBindingActive } from '../src/policy/hard-binding.mjs';
const ok = setHardBindingActive(true);
console.log(ok ? 'HARD_BINDING_ACTIVE' : 'HARD_BINDING_FAILED');
