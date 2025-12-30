const { VARIANT } = require('../build/lib/winapi/uia');
const koffi = require('koffi');
console.log('Size of VARIANT:', koffi.sizeof(VARIANT));
