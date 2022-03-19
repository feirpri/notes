# 以JModule的视角学习single-spa
@copyright 前端技术研讨会

@author 张萍萍、林光辉


## 理解配置与作用

### 宿主应用加载子应用
single-spa
```javascript
import { registerApplication, start } from 'single-spa';

// 注册子应用
registerApplication({
   name: 'app1',
   app: () => import('http://a.com/app1/main.js'),
   activeWhen: '/app1', // 激活条件，监听路由事件响应、手动触发响应
   customProps: {
      some: 'value',
   }
});
// 启动
start();
```

JModule
```javascript
// 注册子应用
const module = new JModule({ // 无 activeRule，由宿主应用定义规则
   key: 'app1',
   url: 'http://a.com/app1/main.js',
   type: 'app',
   some: 'value', // 可从 metadata 属性读取
});
// 启动
module.load();
```

### 子应用接入
single-spa

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

JModule
```javascript
// 初始化Vue实例
export const app = new Vue({
   router,
   i18n,
   store,
   render: (h) => h('router-view'),
}).$mount();

if (modulesMode) { // 基于宿主应用提供的判断条件
   // 子应用模式定义生命周期
   JModule.define('app1', {
      mount(module, el) {
         el.appendChild(app.$el);
      },
      unmount(module) {
         // do sth
      },
      bootstrap: async (module) => {
         console.log(module);
      },
      exports: {},
   });
} else { // 独立运行
   document.getElementById('#app').appendChild(app.$el);
}


/** JModule 模块/插件类型，依赖宿主应用支持 **/
// 宿主应用
import Vue from 'vue';
JModule.exports({
   $platform: {
      vue: Vue,
   },
});

// 子应用
// webpack中配置
{
   externals: {
      Vue: '$platform.vue',
   },
}
// OR
import Vue from '$platform.vue';

// runtime
JModule.define('app1', {
   routes: [], // 路由配置
   exports: {}, // 导出的功能，比如插件组件或者功能函数
});
```



### 微前端通信

single-spa

```javascript 
import {thing} from 'other-microfrontend'
```
JModule
```javascript 
// 访问平台提供的数据
import { thing } from '$platform';

// 访问其它子应用 exports 出来的内容
const Button = await JModule.require('app2.Button');
```


| 用法/功能差异     | Single-spa | JModule |
| :-------------: | :--------: | :-----: |
| **应用注册** | registerApplication() | new JModule() |
| **入口资源** | umd js 文件 | 包含应用资源元数据的 js/json 文件 |
| **子应用声明** | ```export { bootstrap, mount, unmount }``` | ```JModule.define('key', { bootstrap, mount, unmount })``` <br>OR<br> ```JModule.define('key', { routes })``` |
| **应用拆分** | monorepo 等方式 | 相对更自由，应用入口与子应用本身是一对多的关系，甚至可以在一个文件里声明多个子应用，当然也可以采用monorepo 等方式管理 |
| **自定义配置** | customProps | module.metadata |
|  **资源加载** | start() | ```module.load()``` OR ```module.load('load'|'preload', { elementModifier })``` |
|  **资源加载优化**   | [single-spa加载函数](https://zh-hans.single-spa.js.org/docs/configuration#loading-function-or-application) 为你的应用程序和包裹内置了延迟加载。<br>在需要时下载导入映射中的浏览器内模块 | 通过script的prefetch\preload 实现资源预加载，JModule提供api，具体策略由宿主应用实现 |
|**子应用激活**| 自封装了路由事件，通过active函数确定激活 | 由宿主应用自行处理子应用的挂载，如果宿主应用本身拥有一个带路由的框架系统，则应用挂载也是件轻松的事 |
|**本地开发**| Import map<br>[import-map-overrides ](https://github.com/joeldenning/import-map-overrides)  工具将自动允许您在本地主机和部署版本之间切换一个或多个微前端。| 通过webpack插件配置子应用于宿主应用的信息来实现集成开发的目的 |
|**通用模块**| 唯一目的是为其他微前端导出要导入的功能<br>确保webpack externals和import map正确配置 |```JModule.define('key', { exports });``` 通过定义时的exports 属性导出|

> 1. single-spa 包含更多的lifecycle
> 1. single-spa 提供了更多的自定义事件
> 1. JModule 在子应用的拆分上相对更自由
> 1. JModule 本质上无明确的激活与卸载，由普通的基于的路由的视图渲染实现。

#### single-spa 三种微前端类型：

1. Single-spa applications: 受路由控制、渲染组件、single-spa管理生命周期

   生命周期：下载，初始化(bootstrap)，挂载(mount)，卸载(unmount)，移除([unload])，超时(timeouts)

2. Single-spa parcels： 不受路由控制、渲染组件、自定义生命周期   <共享UI或组件>

   生命周期：初始化(bootstrap)，挂载(mount)，卸载(unmount)，更新([update])

   涉及到跨框架的应用之间进行组件调用时，才需要考虑parcel的使用

   例如：`application1` 用Vue编写，包含创建用户的所有UI和逻辑。 `application2`是用React编写的，需要创建一个用户。 使用`single-spa parcels`可以让您包装`application1`中的Vue组件。尽管框架不同，但它可以在`application2`内部运行。

   > 类似需求，在 JModule 中通过 exports 属性公开自己的组件，即可以由其它应用使用，如果是用同一框架编写的组件，使用比较自由，但对于跨框架的情况，仍需要子应用自行对其进行兼容处理。

3. utility modules： 无路由、非渲染组件、没有生命周期  <共享通用逻辑>
   > 从JModule 的角度，如果类似插件组件，通过 exports 属性公开其访问，对于工具组件，仍然欢迎使用 webpack 的代码拆分或者 module federation 功能
