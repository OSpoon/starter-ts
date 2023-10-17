# create-starter-ts

基于此模板进行工具开发

## 使用

安装项目所需依赖

```bash
npm install
```

初始化项目名称, 项目描述, 仓库信息, 开发者信息

```bash
npm run adapt
```

PS: 重复执行原因信息回被覆盖

## 发布

基于 **Github Actions** & **release-it** 的发布流程

### 需要提供

- **GHP_TOKEN**
- **NPM_TOKEN**

PS: 因禁止 `GITHUB_` 作为 `prefix`, 所以使用 `GHP_TOKEN` 代替 `GITHUB_TOKEN`;

### 激活发布

默认手动执行 `actions`, 可在 `.github/workflows/release.yml` 随时调整

## License

[MIT](./LICENSE) License © 2023-PRESENT [填写开发者昵称](https://github.com/填写开发者昵称)
