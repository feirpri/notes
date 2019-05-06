
## 先写一段废话热身
虽然提到了中间人攻击，但这不是一篇安全类文章，要通过中间人修改https内容，必须客户端信任中间人提供的证书。

我做这么一个工作，最原始的需求，是为了解决公司内网环境下 npm 包安装的问题，简单点讲，就是切换仓库和依赖镜像源。常用的 cnpm 也提供镜像功能，也能解决包依赖的硬编码地址问题，但是不支持 lockfile, 也不支持 URLs as Dependencies 方式定义的package。最后决定采用代理的方式，用内网资源去响应外网请求。

整个过程，真的充分感受到了修改 https 请求的不易，毕竟 https 的诞生就是为了防止内容盗取、篡改的。

http请求的代理实现没那么多幺蛾子，就先略了...

## 效果演示
我在本地启动了一个代理服务器，并注入了一些配置，将对 https://www.google.com.hk 的访问重定向到了我在本机运行的一个 https 服务器。

*这里的演示，用的url替换的方式，这部分属于具体的业务逻辑，后文的最终实现为简化版，虽然效果一样~*

![](https://user-gold-cdn.xitu.io/2019/5/5/16a86c4749d2b131?w=696&h=144&f=jpeg&s=124087)

![](https://user-gold-cdn.xitu.io/2019/5/5/16a86c4a40f18c46?w=662&h=364&f=jpeg&s=111049)

## 背景知识
在实现代理服务之前，可以简单了解一下 https 服务的证书认证过程以及代理是怎么工作的。

#### 证书：CA证书 与 域名证书

一个正常 https 服务器的搭建时，我们需要去证书机构申请一个域名证书，这里机构必须是可信的。证书的信任过程是基于信任链的，如果电脑信任了CA, 也就信任了有CA证书签发的域名证书。

所以涉及两个认证：
> 1. 机构认证，对应的就是 CA 证书，在系统里预置了
> 2. 域名证书，用CA证书给域名证书签名，得到一个域名证书

你可以自己生成一个CA证书，用来签各种域名，也就是自签名证书。自签名证书是不能通过验证的，你需要让客户端信任你的CA。

### Proxy 与 直接访问
http(s) 的 代理与普通请求有什么区别？客户端是如何告知代理目标服务器的地址的？我从别人文章里截了个图：

![](https://user-gold-cdn.xitu.io/2019/5/5/16a87a185695fbfc?w=784&h=368&f=png&s=97053)
原文地址：[Http 请求头中的 Proxy-Connection
](https://imququ.com/post/the-proxy-connection-header-in-http-request.html)


## 功能实现

## 一个简单的隧道代理
#### 图片版

![](https://user-gold-cdn.xitu.io/2019/5/6/16a8bdea9d1b3811?w=1300&h=1103&f=webp&s=62960)

#### 文字版
1. 建立 https 服务器作为代理服务器
2. 监听 connect 事件，获取目标服务器地址、端口、ClientSocket
3. 与目标服务器建立连接, 得到TargetSocket，并通知客户端连接建立成功
4. 将 ClientSocket 与 TargetSocket 的数据流互相转发

#### 代码版
```javascript
/** 仅摘取部分核心代码，无法直接运行 **/

const https = require('https');
const fs = require('fs');
const forge = require('node-forge');
const net = require('net');

function connect(clientRequest, clientSocket, head) {
    const protocol = clientRequest.connection?.encrypted ? 'https:' : 'http:';
    const { port = 443, hostname } = url.parse(`${protocol}//${clientRequest.url}`);

    // 连接目标服务器
    const targetSocket = net.connect(port, targetUrl, () => {
        // 通知客户端已经建立连接
        clientSocket.write(
            'HTTP/1.1 200 Connection Established\r\n'
                + 'Proxy-agent: MITM-proxy\r\n'
                + '\r\n',
        );

        // 建立通信隧道，转发数据
        targetSocket.write(head);
        clientSocket.pipe(targetSocket).pipe(clientSocket);
    });
}

// 创建域名证书, 启动https服务作为代理服务器
const serverCrt = createServerCertificate('localhost');
https.createServer({
        key: forge.pki.privateKeyToPem(serverCrt.key),
        cert: forge.pki.certificateToPem(serverCrt.cert),
    })
    .on('connection', console.log)
    .on('connect', connect) // 建立通信隧道
    .listen(6666, () => {
        console.log('代理服务器已启动, 代理地址：https://localhost:6666');
    });
```

### 问题：https代理模式下的证书认证过程是怎样的？
上面的代码实现，看起来可能没什么营养，不过可以帮助理解代理模式下的证书认证过程。上面过程涉及两次认证：
> 1. 代理服务器是 https 服务，客户端与代理服务器之间的连接需要认证
> 2. 客户端需要校验目标服务器的证书，生成会话的加密数据，用于后续通信

嗯，问题是，
> 1. 这两次认证分别发生在什么时候？
> 2. 代码里面 connection、connect 事件分别在什么情况下触发？

可以尝试将代理地址设置成 https://127.0.0.1:6666,_（注意代理域名换了，代理服务的证书验证会成问题）_ 然后你将看到 connection 事件被触发，然后告诉你客户端主动断开了连接...然后...就没有然后了。

如果代理服务器的证书认证通过，将会先后看到 connection、connect 事件被触发。

至于客户端需要校验的目标服务器的证书，是在代理服务与目标服务器建立连接之后，通过 pipe 传给客户端的。

### 问题：如果代理服务器建立的连接不是到目标服务器的，而是另一个服务器，会发生什么？
这个答案也简单，上面两个认证中的第二个，也就是客户端对目标服务器的证书认证是没法通过的，于是连接被断开。

那，如果我们让 “另一个服务器” 响应正确的证书，或者说“伪造目标服务器”，是否就能正确建立连接，然后...为所欲为了？

## 伪造目标服务器
### 证书问题：如果提供任意域名的证书？
我们在搭建一个 https 服务器的时候，通常需要申请一个域名证书，找一个客户端信任的CA给你签。

所以，其实让证书可用条件还算简单，用客户端信任的CA证书签一个域名证书，就可以了。

在我的目标场景下，客户端是由我自己控制的，所以，造一个 CA证书让客户端信任是可行的，既然CA都被信任了，那域名证书也就随便签了。

### 伪造一个https服务，处理多个域名的请求
因为代理的目标地址不确定，可能是 a.com, 也可能是 b.cn, 所以我期望造一个https服务，处理不同域名的请求。

> 这里有一个叫 “SNI”的东西，也就是“服务器名称指示”，用于实现服务与域名的一对多关系。

```javascript
/** 仅摘取部分核心代码，无法直接运行 **/

/** 创建支持多域名的 https 服务 **/
function createFakeHttpsServer() {
    return new https.Server({
        SNICallback: (hostname, callback) => {
            const { key, cert } = createServerCertificate(hostname);
            callback(
                null,
                tls.createSecureContext({
                    key: forge.pki.privateKeyToPem(key),
                    cert: forge.pki.certificateToPem(cert),
                }),
            );
        },
    });
}

const fakeServer = createFakeHttpsServer();

/** 这里是具体的业务，给客户端返回想要提供的内容 **/
fakeServer.on('request', (req, res) => {
    // do something
    // 到这里，证书部分已经通过了，正常响应请求就可以
    res.writeHead(200);
    res.end('hello world\n');
}).listen(0);
```

## 利用代理服务器替换https站点的内容
综合一下上面的步骤：
1. 创建伪造的服务器 fakeServer
2. 创建代理服务器 proxyServer
3. proxyServer 监听客户端的连接请求
4. proxyServer 建立到 fakeServer 的连接
5. proxyServer 建立客户端请求到 fakeServer 之间的通信隧道
6. fakeServer 根据业务需要处理客户端请求

```javascript
/** createServerCertificate 的实现，代码比较长，先忽略了 **/

const https = require('https');
const fs = require('fs');
const forge = require('node-forge');
const net = require('net');
const tls = require('tls');
const url = require('url');
const createServerCertificate = require('./cert');

function connect(clientRequest, clientSocket, head) {
    // 连接目标服务器
    const targetSocket = net.connect(this.fakeServerPort, '127.0.0.1', () => {
        // 通知客户端已经建立连接
        clientSocket.write(
            'HTTP/1.1 200 Connection Established\r\n'
                + 'Proxy-agent: MITM-proxy\r\n'
                + '\r\n',
        );

        // 建立通信隧道，转发数据
        targetSocket.write(head);
        clientSocket.pipe(targetSocket).pipe(clientSocket);
    });
}

/** 创建支持多域名的 https 服务 **/
function createFakeHttpsServer(fakeServerPort = 0) {
    return new Promise((resolve, reject) => {
        const fakeServer = new https.Server({
            SNICallback: (hostname, callback) => {
                const { key, cert } = createServerCertificate(hostname);
                callback(
                    null,
                    tls.createSecureContext({
                        key: forge.pki.privateKeyToPem(key),
                        cert: forge.pki.certificateToPem(cert),
                    }),
                );
            },
        })
        fakeServer
            .on('error', reject)
            .listen(fakeServerPort, () => {
                resolve(fakeServer);
            });
    });
}

function createProxyServer(proxyPort) {
    return new Promise((resolve, reject) => {
        const serverCrt = createServerCertificate('localhost');
        const proxyServer = https.createServer({
            key: forge.pki.privateKeyToPem(serverCrt.key),
            cert: forge.pki.certificateToPem(serverCrt.cert),
        })
        .on('error', reject)
        .listen(proxyPort, () => {
            const proxyUrl = `https://localhost:${proxyPort}`;
            console.log('启动代理成功，代理地址：', proxyUrl);
            resolve(proxyServer);
        });
    });
}

// 业务逻辑
function requestHandle(req, res) {
    res.writeHead(200);
    res.end('hello world\n');
}

// 这里就是入口了
function main(proxyPort) {
    return Promise.all([
        createProxyServer(proxyPort),
        createFakeHttpsServer(), //随机端口
    ]).then(([proxyServer, fakeServer]) => {
        // 建立客户端到伪服务端的通信隧道
        proxyServer.on('connect', connect.bind({
            fakeServerPort: fakeServer.address().port,
        }));
        // 伪服务端处理，可以响应自定义内容
        fakeServer.on('request', requestHandle);
    }).then(() => {
        console.log('everything is ok');
    });
}

// 监听异常，避免意外退出
process.on('uncaughtException', (err) => {
    console.error(err);
});

main(6666);
```

## 参考文档
1. [HTTPS为什么安全 &分析 HTTPS 连接建立全过程
](https://wetest.qq.com/lab/view/110.html)
2. [Http 请求头中的 Proxy-Connection](https://imququ.com/post/the-proxy-connection-header-in-http-request.html)
4. [nodejs文档-tls](https://nodejs.org/api/tls.html)
5. [HTTP 代理原理及实现（一）](https://imququ.com/post/web-proxy.html)
6. [HTTP 代理原理及实现（二）](https://imququ.com/post/web-proxy-2.html)
<!--stackedit_data:
eyJoaXN0b3J5IjpbLTMyNjM5NzM0Nyw3OTAyNTc3NTMsLTI0OT
c1NTc3OCwtMTIwMjI1MjI4Myw5OTExMzc4OTZdfQ==
-->