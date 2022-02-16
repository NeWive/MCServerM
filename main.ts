import Initializer from "./Module/Initializer";

async function main() {
    await Initializer.init();
    await Initializer.test();
}

main().then(() => {
    // let test = [1,2,3,4,5];
    // let question = commandlineHandler.getListQuestion("test", "测试", test, 5);
    // let questionPrompt = commandlineHandler.quiz([question]);
}, (err) => {
    console.log(err);
});
