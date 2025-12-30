
const { UIAClient } = require('../build/lib/winapi/uia');

console.log('Loading UIAClient...');
try {
    const client = new UIAClient();
    console.log('UIAClient created!');
} catch (e) {
    console.error('Failed:', e);
}
