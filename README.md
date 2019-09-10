基础环境
1. 操作系统：windows/ubuntu
2. 浏览器 ： chrome
3. 节点集群 ： 1 js-ipfs（内网） + 4 go-ipfs（1外3内） + 3 ipfs-browser（2外1内）

已知问题
一、Go ipfs 
1. go节点尚未实现wss，只能通过使用nginx反向代理来开启WSS。

二、nodejs ipfs
1.js节点运行一段时间栈溢出问题

解决方案：libp2p模块的 v0.25.4 版本存在问题，更新为0.26.1即可


三、ipfs-browser
1. webcrypto在浏览器引起安全性保护的问题
在公网部上部署ipfs-browser的例子——exchange-file-in-browser，在本地谷歌浏览器中打开报错：

打开bundle.js查看

github issues 描述地址：
https://github.com/libp2p/js-libp2p-crypto/pull/149、https://github.com/ipfs/js-ipfs/issues/964
解决方案：
添加HTTPS证书

访问https://guetdcl.cn:9090

需要启用websocket中转服务器的ssl （websocket服务器可以使用集群式实现高可靠）
websocket中转服务器
rendezvous --cert="/root/cert/Nginx/1_www.guetdcl.cn_bundle.crt"  --key="/root/cert/Nginx/2_www.guetdcl.cn.key" --port=4433  --cryptoChallenge=true


dns4/guetdcl.cn/tcp/8082/wss/p2p-websocket-star/


webrtc信令转服务器
star-sihnal --host=127.0.0.1 --port=9092  & nginx 反向代理到8082端口


/dns/guetdcl.cn/tcp/8083/wss/p2p-webrtc-star/



同时，所有go节点需要通过Nginx来打开WSS，这样才能够与浏览器节点通信。Go节点目前还没实现wss，只能通过Nginx反向代理来实现。
参考：https://github.com/ipfs/go-ipfs/blob/master/docs/transports.md
    https://github.com/socketio/socket.io/issues/1942

Exchange-file 例子查看公网地址：https://guetdcl.cn:9090
使用websocket协议：

使用web-rtc协议：

总结 ：上次工作中，为实现三类节点能够相互连接，我们在测试时令所有节点使用了websocket（ws）协议进行通信。当ipfs-browser服务端部署到公网上的时候，浏览器端虽然可以加载ipfs-browser的代码，但是处于无安全连接的http下，浏览器不能使用一些webcrypto模块的功能，因此浏览器需要通过https从服务端那里加载代码。当ipfs-browser服务端添加ssl证书开启https之后，随之而来的是由于浏览器的安全策略问题，https模式下无法使用websocket不安全连接，这样就无法连接到其他节点了，因此下一步就是配置三类节点的websocket security（wss）。其中js-ipfs节点和ipfs-browser节点可以直接使用wss相互连接，而go节点目前仅支持通过nginx反向代理来实现wss。最后我们搭建了webrtc信令服务器，实现了节点之间的相互连接。
注：即使go节点没有开启wss，浏览器节点也可以通过中继模式连上go节点。如下图所示：




