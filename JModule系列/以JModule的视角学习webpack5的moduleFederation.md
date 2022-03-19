# 以JModule的视角学习webpack5的 module federation

@copyright 前端技术研讨会

@author 林光辉

## 目标
JModule|Webpack
--|--
微前端|以跨项目代码复用为目标兼任微前端



## 理解配置作用
webpack5 Module Federation
```javascript
new ModuleFederationPlugin({
  name: 'host',
  remotes: {
    app1: 'app1@http://localhost:3001/remoteEntry.js',
  },
  exposes: ['./sth'],
  shared: {
      Vue: {
          import: 'vue', // module or fallback
          // 共享域
          shareKey: 'shared-vue',
          shareScope: 'default',
          // 版本相关
          singleton: true,
          strictVersion: true, // 严格匹配
          version: '1.2.3',
          requiredVersion: '^1.0.0',
      },
  },
})

// runtime
function loadComponent(scope, module) {
  return async () => {
    // Initializes the share scope. This fills it with known provided modules from this build and all remotes
    await __webpack_init_sharing__('default');
    const container = window[scope]; // or get the container somewhere else
    // Initialize the container, it may provide shared modules
    await container.init(__webpack_share_scopes__.default);
    const factory = await window[scope].get(module);
    const Module = factory();
    return Module;
  };
}
```

JModule
```javascript
// compiler
new JModulePlugin({
    mode: 'modules',
    customEntry: true,
    devConfig: devMode ? {
        modulesConfig: {
            jdosCD: {
                name: 'JDOS部署',
            },
        },
        currentServer: 'http://local.jd.com:8084',
        platformServer: 'http://jagile-pr.jd.com',
        platformProxyTable: {},
        platformLocalPort: 8088,
    } : undefined,
})
// runtime
import sth from './sth';

JModule.define('deployRoot', {
    // 共享主框架
    routes,
    defaultRouteName,
    // 独立应用
    bootstrap() {},
    mount() {},
    // 初始化函数
    init(module) {},
    // 功能共享
    exports: { sth },
    // 依赖声明，构建依赖树
    imports: process.env.VUE_APP_MODULES.split(','),
});
```
功能|Webpack5|JModule
--|--|--
应用名|name|moduleKey
公开应用API|【compiler】exposes|【runtime】exports
使用应用API|```import('app2/Button')```|```JModule.require('app2/Button')```
开发集成调试|【主应用, compiler】remotes|【子应用】devConfig
生产环境子模块加载|__webpack_init_sharing__, init/get,(或者用 remotes 编译进去)|```JModule.registerModules()```
共享组件库|【compiler】```shared: ['Vue', 'moments']```|【runtime】```JModule.export({ Vue, moments })```
共享组件库-Key|```shared.shareKey: [someKey]```|```JModule.export({ [someKey]: something }```)
共享组件库-Scope|```shared.shareScope: [someScope]```|```JModule.export({}, { scope: [someScope] }); ```
共享组件库-使用|compiler保持相同编译配置，runtime正常引用|compiler通过externalAlias，runtime正常使用 或【runtime】``` import something from [someScope]:[someKey]```
共享组件版本|version/singleton/...|no support,协商

    webpack5 作为性能优化避免重复打包、加载包，很擅长；作为微前端时，相当于提供核心的拆分加载能力，但在项目中使用时需要额外约定规范或框架支持。
