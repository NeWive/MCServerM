const express = require('express');
const bodyParser = require('body-parser');
const customCmd = require('../customCmd.config');

class HTTPServer {
    constructor() {
        this.port = 8999;
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
            console.log(`http server is listening on port ${this.port}`)
        });
    }
}

module.exports = HTTPServer;