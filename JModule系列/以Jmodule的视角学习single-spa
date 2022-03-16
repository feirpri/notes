# 以JModule的视角学习webpack5的 module federation

@copyright 前端技术研讨会

@author 张萍萍、林光辉

|                 |                          Single-spa                          |                           JModule                            |
| :-------------: | :----------------------------------------------------------: | :----------------------------------------------------------: |
|  **架构概览**   | 1.Applications <br/>2. [single-spa-config](https://zh-hans.single-spa.js.org/docs/configuration)配置 |                                                              |
| **Root-config** | 1. 所有微前端应用共享的根 HTML 页面<br>2.singleSpa.registerApplication() |                                                              |
|  **拆分应用**   |          1. monorepo<br>2.NPM包 <br>3. 动态加载模块          |                 `JModule.applyResource({})`                  |
|  **本地开发**   | Import map<br>[import-map-overrides ](https://github.com/joeldenning/import-map-overrides)  工具将自动允许您在本地主机和部署版本之间切换一个或多个微前端。 |              子应用配置平台信息即可实现本地开发              |
|  **资源加载**   | [single-spa加载函数](https://zh-hans.single-spa.js.org/docs/configuration#loading-function-or-application) 为你的应用程序和包裹内置了延迟加载。<br>在需要时下载导入映射中的浏览器内模块 | 预先下载所有JavaScript,在需要执行的时候在执行<br>`<link rel="preload" as="script">` |
|  **通用模块**   | 唯一目的是为其他微前端导出要导入的功能<br>确保webpack externals和import map正确配置 |                              --                              |
|  **共享依赖**   | 1.  [运行时import maps](https://zh-hans.single-spa.js.org/docs/recommended-setup#import-maps) <br>2. [构建时module federation](https://zh-hans.single-spa.js.org/docs/recommended-setup#module-federation) |                              --                              |

#### single-spa 三种微前端类型：

1. Single-spa applications: 受路由控制、渲染组件、single-spa管理生命周期

   生命周期：下载，初始化(bootstrap)，挂载(mount)，卸载(unmount)，移除([unload])，超时(timeouts)

2. Single-spa parcels： 不受路由控制、渲染组件、自定义生命周期   <共享UI或组件>

   生命周期：初始化(bootstrap)，挂载(mount)，卸载(unmount)，更新([update])

   涉及到跨框架的应用之间进行组件调用时，才需要考虑parcel的使用

   例如：`application1` 用Vue编写，包含创建用户的所有UI和逻辑。 `application2`是用React编写的，需要创建一个用户。 使用`single-spa parcels`可以让您包装`application1`中的Vue组件。尽管框架不同，但它可以在`application2`内部运行。

3. utility modules： 无路由、非渲染组件、没有生命周期  <共享通用逻辑>



#### 微前端通信

`import {thing} from 'other-microfrontend'`是微前端间通信的首选方式。



#### 性能考虑

出于性能考虑，强烈建议框架（如：React, Vue, or Angular等）级别的实例仅引用一次，[具体做法参考](https://zh-hans.single-spa.js.org/docs/recommended-setup#shared-dependencies)。

