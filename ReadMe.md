# MinecraftServerManager

## File and Dir Descriptions
### `FrpConfiguration/`
存放Frp配置文件
### `Server/`
Server.jar and other necessary assets
### `Backup/`
backup files
### `Backup/slots.json`
### `FrpClient/`

## Code Description
### Enums
#### `Status`
- OK: 1
- FAILED: 0
### ReturnObject
All the functions are covered by Promise

if the function finished successfully, it will return
`{ status: Status.OK }`

if data is needed, it will return 
`{ status: Status.OK, data: data }`

if failed, it'll return 
`{ status: Status.FAILED, code: ErrCode.Code, message: msg }`

## Configs
### `global.config.js`
```js
// example
module.exports = {
    frpConfigDir: 'xxx',
    serverMemoryAllocated: '6g',
    toggleGui: false,
    serverTarget: 'fabric-server-launch.jar',
    backupDir: 'xxx',
    frpClientDir: 'xxxx',
    frpClientTarget: 'xxx',
}

```
### `tcp.config.js`
```js
// example
module.exports = {
    salt: 'xxx'
}
```
### `server.config.js`
```js
module.exports = {
    DONE: 'xxx'
}
```
