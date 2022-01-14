import ora from "ora";
import inquirer from "inquirer";
import {SpinnerName} from 'cli-spinners';

class CommandlineHandler {

    clearScreen() {
        console.clear();
    }

    tips(info: string, icon: SpinnerName, color: ora.Color = "white") {
        return ora({
            text: info,
            spinner: icon,
            color
        });
    }

    getInputQuestion(name: string, question: string) {
        return {
            name,
            message: question
        }
    }

    getListQuestion(name: string, question: string, choices: Array<any> = [], pageSize = 6, loop: boolean = false) {
        return {
            name,
            message: question,
            type: "list",
            choices,
            loop
        }
    }

    quiz(questions: Array<inquirer.Question>) {
        return inquirer.prompt(questions);
    }

    async getServerName() {
        let answer = await commandlineHandler.quiz([commandlineHandler.getInputQuestion("serverName", "给你的服务器取个名字吧: ")]);
        return answer["serverName"];
    }
}

const commandlineHandler = new CommandlineHandler();

export default commandlineHandler;
