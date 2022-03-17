# 以JModule的视角学习single-spa
@copyright 前端技术研讨会

@author 张萍萍、林光辉

|                 |                          Single-spa                          |                           JModule                            |
| :-------------: | :----------------------------------------------------------: | :----------------------------------------------------------: |
|  **架构概览**   | 1.Applications <br/>2. [single-spa-config](https://zh-hans.single-spa.js.org/docs/configuration)配置 |                                                              |
| **Root-config** | 1. 所有微前端应用共享的根 HTML 页面<br>2.singleSpa.registerApplication() |                    `JModule.define`子应用                    |
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

#### 配置详情

##### root config

```javascript
// single-spa-config.js
import { registerApplication, start } from 'single-spa';
// Simple usage
registerApplication(
  'app2',  //应用名称
  () => import('src/app2/main.js'), //Promise类型的加载函数
  (location) => location.pathname.startsWith('/app2'), // 激活函数
  { some: 'value' } // 自定义属性
  // 如果自定属性是一个函数，函数的参数是应用的名字（application name)和当前window.location
);

const application = {
    bootstrap: () => Promise.resolve(), //bootstrap function
    mount: () => Promise.resolve(), //mount function
    unmount: () => Promise.resolve(), //unmount function
  } // 已经解析的应用
registerApplication('applicationName', application, activityFunction)

// 激活函数
// 另外一种场景是single-spa根据顶级路由查找应用，而每个应用会处理自身的子路由。

// 在以下情况下，single-spa将调用每个应用的活动函数：

// hashchange or popstate事件触发时
// pushState or replaceState被调用时
// 在single-spa上手动调用[triggerAppChange] 方法
// checkActivityFunctions方法被调用时

// Config with more expressive API
registerApplication({
    name: 'app1',
    app: () => import('src/app1/main.js'),
    activeWhen: '/app1',
    customProps: {
      some: 'value',
    }
});

start();
```

##### 子应用接入

```javascript
// React接入示例
import React from 'react';
import ReactDOM from 'react-dom';
import singleSpaReact from 'single-spa-react';
import Root from './root.component.tsx';

const reactLifecycles = singleSpaReact({
  React,
  ReactDOM,
  rootComponent: Root,
  domElementGetter,
});

/** 
const {
    name,        // 应用名称
    singleSpa,   // singleSpa实例
    mountParcel, // 手动挂载的函数
    customProps  // 自定义属性
} = props;     // Props 会传给每个生命周期函数
*/

export function bootstrap(props) {
  return reactLifecycles.bootstrap(props);
}

export function mount(props) {
  return reactLifecycles.mount(props);
}

export function unmount(props) {
  return reactLifecycles.unmount(props);
}

function domElementGetter() {
  // Make sure there is a div for us to render into
  let el = document.getElementById('app1');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app1';
    document.body.appendChild(el);
  }

  return el;
}

```



```javascript
//vue 接入示例
import Vue from 'vue'
import App from './App.vue'
import router from './router'
import singleSpaVue from 'single-spa-vue'

Vue.config.productionTip = false

const appOptions = {
  el: '#microApp',
  router,
  render: h => h(App)
}

// 支持应用独立运行、部署，不依赖于基座应用
if (!window.singleSpaNavigate) {
  delete appOptions.el
  new Vue(appOptions).$mount('#app')
}

// 基于基座应用，导出生命周期函数
const vueLifecycle = singleSpaVue({
  Vue,
  appOptions
})

export function bootstrap (props) {
  console.log('app1 bootstrap')
  return vueLifecycle.bootstrap(() => {})
}

export function mount (props) {
  console.log('app1 mount')
  return vueLifecycle.mount(() => {})
}

export function unmount (props) {
  console.log('app1 unmount')
  return vueLifecycle.unmount(() => {})
}

```



#### 微前端通信

`import {thing} from 'other-microfrontend'`是微前端间通信的首选方式。



#### 性能考虑

出于性能考虑，强烈建议框架（如：React, Vue, or Angular等）级别的实例仅引用一次，[具体做法参考](https://zh-hans.single-spa.js.org/docs/recommended-setup#shared-dependencies)。

