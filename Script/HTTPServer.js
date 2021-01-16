const express = require('express');
const bodyParser = require('body-parser');
const customCmd = require('../playerCmd.config');
const Utils = require('./Util');
const colors = require('colors');

class HTTPServer {
    constructor() {
        this.port = 9000;
    }

    _print(msgArr, source) {
        msgArr.forEach(msg => {
            Utils.outputLog([colors.green(`[${source}]: `) + msg]);
        });
    }

    start() {
        this.httpServ = express();
        this.httpServ.use(bodyParser.json());
        this.httpServ.post('/', (req, res) => {
            let data = req.body;
            let result = customCmd.indexOf(data.cmd);
            if (result > -1) {
                this.listener.emit('execute-cmd', { cmd: data.cmd, args: data.args });
                res.header("content-type", "application/json");
                res.send(JSON.stringify({msg: 'success'}));
            } else {
                res.header("content-type", "application/json");
                res.send(JSON.stringify({msg: 'unknown command'}));
            }
        });
        this.httpServ.listen(this.port, () => {
            this._print([`http server is listening on port ${this.port}`], 'HTTPServer');
        });
    }
}

module.exports = HTTPServer;