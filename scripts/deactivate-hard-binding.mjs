import { setHardBindingActive } from '../src/policy/hard-binding.mjs';
const ok = setHardBindingActive(false);
console.log(ok ? 'HARD_BINDING_INACTIVE' : 'HARD_BINDING_FAILED');
