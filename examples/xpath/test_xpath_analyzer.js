const XPathAnalyzer = require('xpath-analyzer').default;

const selector = "//Window[@Name='OK']";
try {
    const analyzer = new XPathAnalyzer(selector);
    const ast = analyzer.parse();
    console.log(JSON.stringify(ast, null, 2));
} catch (e) {
    console.error("Failed to parse:", e);
    const obj = require('xpath-analyzer');
    console.log("Keys in xpath-analyzer:", Object.keys(obj));
    if (obj.default) {
        console.log("Default export is a constructor:", typeof obj.default === 'function');
    }
}
