# Minecraft Server Side Manager

一个Minecraft 服务端管理工具。

## 环境

NodeJS v14.17

## 启动

1.   在项目根目录下安装依赖，执行 `npm install`
2.   运行命令 `npm run start` 

## 备份模块

须在MC服务器开启的前提下使用

### `/backup <tips>`

备份命令

-   tips，必填，当前备份的备注

### `/slot_list`

显示当前服务器的备份列表

### `/rollback <index>`

回滚

-   index，必填，根据 `/slot_list` 命令中的 `index_number` ，回滚到对应的备份

## To-do List模块

须在开服的前提下使用

### `/gugu <sub_cmd>`

-   sub_cmd: 
    -   `list`: 展示所有待办事项
    -   `add <to_do>`: 添加待办事项
    -   `done <to_do>`: 完成待办事项

## TO DO

1.   尝试完成Forge的一键安装
2.   优化日志输出
3.   尝试添加UI模块

## 欢迎捉虫！┌(。Д。)┐

## Version: 1.0.0

-   提供命令行管理方式
-   提供原版和Fabric服务端的自动化下载（需手动确定版本号）
-   提供服务端的备份管理，包括对配置文件、存档的打包及回滚
-   记录执行命令历史

