# Notion Image & Page Viewer

一个基于 Notion API 的图片托管和页面展示服务。支持图片、文件和页面内容的展示，并提供自定义访问路径功能。

## 功能特性

### 内容展示
- Rich text 格式（粗体、斜体、下划线、删除线）
- 文本颜色和背景颜色
- 标题（H1、H2、H3）
- 列表（有序和无序）
- 代码块（支持语法高亮）
- 图片（支持说明文字）
- 引用和标注
- 表格
- 折叠块
- 链接和书签
- 文件附件
- 嵌入内容（视频、PDF等）

### 图片功能
- 懒加载优化
- 图片压缩
- 点击放大查看
- 支持图片说明
- 响应式图片大小

### 代码块功能
- 多种编程语言的语法高亮
- 左上角显示语言标签
- 一键复制代码
- 悬停显示复制按钮
- 复制操作的视觉反馈

### 导航功能
- 返回上级页面按钮
- 可配置返回按钮显示（使用 Back 属性）
- 面包屑式导航
- 支持子页面

### 页面信息
- 页面标题
- 最后编辑时间显示
- 加载进度指示
- 错误处理和回退机制

### 自定义访问路径（Suffix）功能
- 支持为页面设置自定义访问路径
- 多个页面可以共享同一个访问路径
- 自动生成带有相同 suffix 的页面列表

## 配置说明

### 环境变量
- `NOTION_TOKEN`: Notion API 密钥
- `NOTION_DATABASE_ID`: Notion 数据库 ID

### Notion 数据库属性配置

#### 必需属性
1. `Name`（标题类型）：页面标题
2. `Content`（文件类型）：图片或文件内容

#### 可选属性
1. `suffix`（文本类型）：自定义访问路径
   - 在数据库中添加一个名为 "suffix" 的属性
   - 类型选择 "Text"（文本）
   - 在需要的页面中填写访问路径（例如：blog）

2. `Back`（选择类型）：控制返回按钮显示
   - True：显示返回按钮
   - False：隐藏返回按钮

3. `Hidden`（选择类型）：控制在列表中的显示
   - True：在列表中隐藏
   - False：在列表中显示

## 使用方法

### 基本访问
- `/page/{page_id}`：直接通过页面 ID 访问
- `/image/{image_id}`：访问图片
- `/file/{file_id}`：访问文件

### 使用自定义路径（Suffix）
1. 设置 suffix
   - 打开 Notion 数据库
   - 在要设置的页面的 suffix 属性中填写自定义路径

2. 访问方式
   - 单个页面：直接访问 `/{suffix}` 会显示该页面
   - 多个页面：访问 `/{suffix}` 会显示所有使用该 suffix 的页面列表

### 示例
1. 单页面访问
   ```
   设置：页面的 suffix = "about"
   访问：https://your-domain.com/about
   ```

2. 多页面列表
   ```
   设置：多个页面的 suffix = "blog"
   访问：https://your-domain.com/blog
   结果：显示所有 suffix 为 "blog" 的页面列表
   ```

## 开发说明

### 技术栈
- Backend: FastAPI
- Frontend: TailwindCSS
- API: Notion API

### 本地开发
1. 克隆仓库
2. 安装依赖：`pip install -r requirements.txt`
3. 设置环境变量
4. 运行服务：`python main.py`

## 注意事项
1. suffix 属性必须设置为文本（Text）类型
2. 建议使用简单的英文字母、数字和连字符作为 suffix
3. 页面更新后，suffix 的变更可能需要重启服务才能生效 