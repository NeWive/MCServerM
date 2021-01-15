const net = require('net');
const crypto = require('crypto');
const Utils = require('./Util');
const colors = require('colors');
const config = require('../tcp.config');

class TCPServer {
    constructor(listener) {
        this.listener = listener;
        this.server = null;
        this.port = 8999;
        this.socketList = [];
        this.keys = ['msg'];
        this.salt = config.salt;
    }

    outputLog (d) {
        Utils.outputLog([colors.green('[TCPServer]: '), d])
    }

    validateMsg (d, s) {
        this.rules = {
            'msg': (d) => {
                try {
                    let list = [`msg`, `time`, `token`];
                    let target = '';
                    for(let i of list) {
                        if(!d.hasOwnProperty(i)) {
                            return 'invalid args';
                        } else {
                            if (i !== 'token')
                                target += d[i];
                        }
                    }
                    target += this.salt;
                    let hash = crypto.createHash('sha256');
                    hash.update(target);
                    let result = hash.digest('hex');
                    if (result === d.token) {
                        return 'accepted';
                    } else {
                        return 'unauthorized';
                    }
                } catch(e) {
                    return 'err';
                }
            }
        };
        return this.rules[d.type](d);
    }

    resMsg (m, s) {
        s.write(JSON.stringify({
            type: 'response',
            msg: m
        }))
    }

    dealMsg (d, s) {
        if (d.type && this.keys.indexOf(d.type) > -1) {
            let msg = this.validateMsg(d, s);
            this.resMsg(msg, s);
            if (msg === 'accepted') {
                // console.log(d);
                d.type === 'msg' && this.listener.emit(d.type, d);
            }
        } else {
            this.resMsg('incomplete args', s);
        }
    }

    stop () {
        this.socketList.forEach((s) => {
            s.destroy();
        });
        this.socketList = [];
        this.server.close();
    }

    start () {
        this.server = net.createServer();
        this.server.listen(this.port, () => {
            this.outputLog(`tcp server is listening on ${this.port}`)
        });
        this.server.on('connection', (socket) => {
            this.outputLog(socket.address());
            this.socketList.push(socket);
            socket.write(JSON.stringify({
                type: 'connection',
                msg: 'connected'
            }));
            socket.on('close', () => {
                this.outputLog('client disconneted!');
                this.socketList.splice(this.socketList.indexOf(socket), 1);
            });
            socket.on("error", (err) => {
                this.outputLog('client error disconneted!');
                this.socketList.splice(this.socketList.indexOf(socket), 1);
            });
            socket.on('data', (data) => {
                try {
                    console.log(data.toString());
                    data = JSON.parse(data.toString());
                    this.dealMsg(data, socket);
                } catch(e) {
                    console.log(e);
                    socket.write(JSON.stringify({
                        type: 'error',
                        msg: '给爷爬'
                    }));
                }
            });
        });
        this.server.on('close', () => {
            this.outputLog('Server closed');
        });
        this.server.on('error', (e) => {
            this.outputLog('Server error' + e);
        })
    }
}

module.exports = TCPServer;