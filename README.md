# 音乐指挥家 - 手势控制音乐播放网站

这是一个基于MediaPipe和Web Audio API的音乐指挥家网站，通过摄像头捕捉手部动作来控制音乐播放。

## 功能特点

- 🎵 **手势控制音乐播放**：通过不同手势控制播放、暂停、音量、速度和曲目切换
- ✋ **实时手部追踪**：使用MediaPipe Hands模型实时检测手部21个关键点
- 🎨 **美观的用户界面**：现代化设计，响应式布局，支持各种屏幕尺寸
- 🔊 **完整的音频控制**：集成Web Audio API，支持音量、播放速度调节
- 📱 **跨平台兼容**：支持Chrome、Edge、Firefox等现代浏览器

## 手势映射

| 手势 | 动作 | 说明 |
|------|------|------|
| ✋ 张开手掌 | 播放/继续播放 | 手掌完全张开 |
| ✊ 握拳 | 暂停播放 | 手指握成拳头 |
| 👆👇 食指上下移动 | 控制音量 | 食指抬高增加音量，降低减少音量 |
| 👈👉 手左右移动 | 控制播放速度 | 向左移动减慢，向右移动加快 |
| ✌️ 胜利手势 (V字) | 切换下一曲 | 食指和中指伸直，其他手指弯曲 |

## 快速开始

### 方法1：使用本地HTTP服务器（推荐）

1. 确保已安装Python 3.x 或 Node.js
2. 运行启动脚本：
   - Windows: 双击 `start-server.bat`
   - 其他系统: 在终端运行 `python -m http.server 8080`
3. 打开浏览器访问：`http://localhost:8080`

### 方法2：直接打开文件
直接双击 `index.html` 文件（注意：摄像头功能可能需要HTTPS环境）

## 文件结构

```
├── index.html          # 主HTML文件
├── style.css           # 样式表
├── script.js           # 主JavaScript逻辑
├── start-server.bat    # Windows启动脚本
└── README.md           # 说明文档
```

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **手部追踪**: [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands)
- **音频处理**: [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- **图标**: [Font Awesome](https://fontawesome.com)
- **字体**: 系统默认字体

## 浏览器兼容性

- Chrome 90+ (推荐)
- Edge 90+
- Firefox 88+
- Safari 14.7+

**注意**: 需要摄像头权限，建议在HTTPS环境或localhost下运行以获得最佳兼容性。

## 自定义配置

### 更换音乐曲目
编辑 `script.js` 文件中的 `tracks` 数组：

```javascript
const tracks = [
    {
        title: "曲目名称",
        artist: "艺术家",
        url: "音频文件URL"
    },
    // 添加更多曲目...
];
```

### 调整手势灵敏度
修改 `script.js` 中的手势检测阈值：

```javascript
// 握拳检测阈值
return avgDistance < 0.15; // 减小值使检测更敏感

// 张开手掌检测阈值  
return avgDistance > 0.25; // 增加值使检测更敏感
```

### 修改UI样式
编辑 `style.css` 文件自定义颜色、布局和动画效果。

## 故障排除

### 摄像头无法启动
- 确保已授予浏览器摄像头权限
- 检查摄像头是否被其他应用占用
- 尝试在Chrome浏览器中运行

### 手势识别不准确
- 确保手部在摄像头画面中清晰可见
- 调整照明条件，避免过暗或过亮
- 尝试减慢手势速度

### 音频无法播放
- 检查音频URL是否可访问
- 确保浏览器支持Web Audio API
- 查看浏览器控制台是否有错误信息

## 开发说明

本项目为纯前端应用，无需后端服务器。所有处理均在浏览器中完成。

### 核心模块
1. **MediaPipe初始化** (`initMediaPipe()`): 配置手部检测模型
2. **摄像头管理** (`startCamera()`, `stopCamera()`): 处理视频流
3. **手势识别** (`analyzeGesture()`): 分析手部关键点并识别手势
4. **音频控制** (`initAudio()`, 音乐控制函数): 管理音频播放

### 扩展建议
- 添加更多手势控制（如调节音高、添加特效）
- 集成音乐可视化效果
- 支持上传本地音乐文件
- 添加手势训练模式

## 许可证

本项目采用MIT许可证，仅供学习和演示使用。

## 致谢

- Google MediaPipe团队提供优秀的手部追踪模型
- MDN Web Docs提供详细的Web API文档
- 所有开源社区贡献者

---

**开始你的音乐指挥之旅吧！** 🎶👋