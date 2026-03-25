// 音乐指挥家 - 主JavaScript文件

// 全局变量
let camera = null;
let cameraStream = null;
let frameRequestId = null;
let hands = null;
let handsReady = false;
let audioContext = null;
let audioElement = null;
let audioSource = null;
let gainNode = null;
let playbackRate = 1.0;
let isPlaying = false;
let currentTrackIndex = 0;
let lastGesture = null;
let lastGestureTime = 0;
let gestureCooldown = 500; // 手势冷却时间（毫秒）
let volumeHistory = [];
let speedHistory = [];

// 音乐曲目列表（使用公开可访问的示例音频和用户上传的音乐）
let tracks = [
    {
        title: "示例音乐 1",
        artist: "古典乐章",
        url: "https://assets.codepen.io/242518/test-music.mp3",
        isUploaded: false,
        id: 'sample-1'
    },
    {
        title: "示例音乐 2",
        artist: "电子节奏",
        url: "https://assets.codepen.io/242518/test-music-2.mp3",
        isUploaded: false,
        id: 'sample-2'
    },
    {
        title: "示例音乐 3",
        artist: "环境音乐",
        url: "https://assets.codepen.io/242518/test-music-3.mp3",
        isUploaded: false,
        id: 'sample-3'
    }
];

// 上传的音乐管理
let selectedFile = null;
let uploadedTracksMap = new Map(); // 存储上传的音乐数据（URL对象）

// DOM元素引用
const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startCameraBtn = document.getElementById('startCamera');
const stopCameraBtn = document.getElementById('stopCamera');
const cameraStatusText = document.getElementById('cameraStatusText');
const cameraStatusIndicator = document.getElementById('cameraStatusIndicator');
const handsCountElement = document.getElementById('handsCount');
const confidenceElement = document.getElementById('confidence');
const gestureIcon = document.getElementById('gestureIcon');
const gestureName = document.getElementById('gestureName');
const gestureDescription = document.getElementById('gestureDescription');
const playPauseBtn = document.getElementById('playPause');
const stopMusicBtn = document.getElementById('stopMusic');
const prevTrackBtn = document.getElementById('prevTrack');
const nextTrackBtn = document.getElementById('nextTrack');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const musicStatus = document.getElementById('musicStatus');
const timeDisplay = document.getElementById('timeDisplay');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');

// 上传相关DOM元素引用
const musicFileInput = document.getElementById('musicFileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const uploadFileBtn = document.getElementById('uploadFileBtn');
const clearUploadsBtn = document.getElementById('clearUploadsBtn');
const selectedFileName = document.getElementById('selectedFileName');
const fileSize = document.getElementById('fileSize');
const uploadedCount = document.getElementById('uploadedCount');
const uploadedTracksList = document.getElementById('uploadedTracksList');

// 初始化函数
function init() {
    // 设置事件监听器
    startCameraBtn.addEventListener('click', startCamera);
    stopCameraBtn.addEventListener('click', stopCamera);
    playPauseBtn.addEventListener('click', togglePlayPause);
    stopMusicBtn.addEventListener('click', stopMusic);
    prevTrackBtn.addEventListener('click', prevTrack);
    nextTrackBtn.addEventListener('click', nextTrack);
    volumeSlider.addEventListener('input', updateVolume);
    speedSlider.addEventListener('input', updateSpeed);
    
    // 上传相关事件监听器
    selectFileBtn.addEventListener('click', () => musicFileInput.click());
    musicFileInput.addEventListener('change', handleFileSelect);
    uploadFileBtn.addEventListener('click', handleFileUpload);
    clearUploadsBtn.addEventListener('click', clearAllUploads);
    
    // 初始化音频
    initAudio();
    
    // 初始化MediaPipe Hands
    initMediaPipe();
    
    // 更新UI
    updateTrackInfo();
    updateMusicStatus();
    
    console.log('音乐指挥家初始化完成');
    
    // 添加页面卸载时的清理
    window.addEventListener('beforeunload', () => {
        // 释放所有上传音乐的对象URL
        for (const [trackId, data] of uploadedTracksMap) {
            URL.revokeObjectURL(data.objectUrl);
        }
        uploadedTracksMap.clear();
        console.log('已清理上传的音乐资源');
    });
}

// 初始化音频系统
function initAudio() {
    try {
        console.log('正在初始化音频系统...');
        // 创建音频上下文
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('音频上下文创建成功:', audioContext.state);
        
        // 创建音频元素
        audioElement = new Audio();
        audioElement.crossOrigin = "anonymous";
        console.log('音频元素创建成功');
        
        // 创建增益节点用于音量控制
        gainNode = audioContext.createGain();
        
        // 连接音频节点
        audioSource = audioContext.createMediaElementSource(audioElement);
        audioSource.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // 设置初始音量
        gainNode.gain.value = volumeSlider.value / 100;
        
        // 音频事件监听器
        audioElement.addEventListener('loadedmetadata', () => {
            console.log('音频元数据加载完成，时长:', audioElement.duration, '秒');
            updateMusicStatus();
            updateTimeDisplay();
        });
        
        audioElement.addEventListener('timeupdate', updateTimeDisplay);
        audioElement.addEventListener('ended', nextTrack);
        audioElement.addEventListener('error', (e) => {
            console.error('音频加载错误:', e);
            console.error('音频错误详情:', audioElement.error);
            musicStatus.textContent = '加载错误';
        });
        
        audioElement.addEventListener('canplaythrough', () => {
            console.log('音频可以播放，无需缓冲');
        });
        
        // 加载第一首曲目
        console.log('开始加载第一首曲目...');
        loadTrack(currentTrackIndex);
        
    } catch (error) {
        console.error('初始化音频系统失败:', error);
        musicStatus.textContent = '音频系统不可用';
        disableMusicControls();
    }
}

// 初始化MediaPipe Hands
function initMediaPipe() {
    try {
        // 检查浏览器是否支持WebAssembly
        if (typeof WebAssembly === 'undefined') {
            throw new Error('您的浏览器不支持WebAssembly，无法运行手部识别功能。请使用最新版本的Chrome、Edge或Firefox浏览器。');
        }
        
        console.log('正在初始化MediaPipe Hands...');
        console.log('WebAssembly支持: 已启用');
        
        // 使用可靠的CDN链接
        const cdnBaseUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/';
        console.log('使用CDN:', cdnBaseUrl);
        
        // WASM加载状态跟踪
        let wasmLoadAttempts = 0;
        const maxWasmLoadAttempts = 3;
        
        hands = new Hands({
            locateFile: (file) => {
                const url = cdnBaseUrl + file;
                
                // 特殊处理WASM相关文件
                if (file.includes('wasm') || file.endsWith('.wasm') || file.includes('_wasm_bin')) {
                    wasmLoadAttempts++;
                    console.log(`加载WASM文件 (尝试 ${wasmLoadAttempts}/${maxWasmLoadAttempts}):`, file);
                    
                    if (wasmLoadAttempts > maxWasmLoadAttempts) {
                        console.error('WASM文件加载失败多次，请检查网络连接或浏览器设置');
                        throw new Error(`WASM文件加载失败: ${file}`);
                    }
                } else {
                    console.log('加载MediaPipe文件:', file);
                }
                
                return url;
            }
        });
        
        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        // 设置结果回调
        hands.onResults(onHandsResults);
        
        console.log('MediaPipe Hands初始化完成，开始加载WASM模块...');
        
        // 监听WASM加载错误
        window.addEventListener('error', (event) => {
            if (event.filename && event.filename.includes('_wasm_bin')) {
                console.error('WASM模块加载错误:', event.message);
                console.error('错误发生在:', event.filename);
                
                // 提供用户友好的错误信息
                if (event.message.includes('Cross-origin')) {
                    console.error('跨域错误: WASM文件需要正确的CORS头。请确保使用HTTPS或本地服务器。');
                }
            }
        });
        
        // 添加一个测试，验证MediaPipe是否正常工作
        setTimeout(() => {
            if (!handsReady) {
                console.warn('MediaPipe模型仍在加载中，这可能需要几秒钟...');
                console.warn('提示: 确保您的网络连接正常，并且没有广告拦截器阻止MediaPipe资源。');
            }
        }, 5000);
        
    } catch (error) {
        console.error('MediaPipe Hands初始化失败:', error);
        
        let errorMessage = '无法加载手部识别模型。\n';
        if (error.message.includes('WASM')) {
            errorMessage += '可能的原因:\n';
            errorMessage += '1. 网络连接问题，无法加载WASM模块\n';
            errorMessage += '2. 浏览器广告拦截器阻止了MediaPipe资源\n';
            errorMessage += '3. 浏览器安全设置限制WebAssembly\n';
            errorMessage += '\n建议:\n';
            errorMessage += '- 暂时禁用广告拦截器\n';
            errorMessage += '- 使用Chrome或Edge浏览器\n';
            errorMessage += '- 确保使用HTTPS或localhost\n';
        }
        
        alert(errorMessage);
    }
}

// 启动摄像头
async function startCamera() {
    try {
        console.log('正在请求摄像头权限...');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
            },
            audio: false
        });
        
        console.log('摄像头流已获取:', stream.id);
        videoElement.srcObject = stream;
        cameraStream = stream;
        
        // 设置视频事件监听器
        videoElement.onloadedmetadata = () => {
            console.log('视频尺寸:', videoElement.videoWidth, 'x', videoElement.videoHeight);
            console.log('视频就绪，开始播放...');
            videoElement.play().catch(e => {
                console.warn('自动播放被阻止:', e.message);
            });
        };
        
        videoElement.onerror = (error) => {
            console.error('视频元素错误:', error);
        };
        
        // 开始发送帧到MediaPipe Hands
        function sendFrameToMediaPipe() {
            if (!cameraStream || !hands) {
                // 如果摄像头已停止或Hands未初始化，退出循环
                return;
            }
            
            // 检查是否应该暂停发送（由于连续失败）
            const now = Date.now();
            if (window._pauseUntil && now < window._pauseUntil) {
                // 还在暂停期，跳过这一帧
                frameRequestId = requestAnimationFrame(sendFrameToMediaPipe);
                return;
            }
            
            // 确保视频已准备好
            if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                // 记录第一次发送帧
                if (window._frameCount === undefined) {
                    window._frameCount = 0;
                    window._sendFailures = 0;
                    window._pauseUntil = 0;
                }
                
                window._frameCount++;
                
                // 只在模型未准备好时记录前几帧
                if (!handsReady) {
                    if (window._frameCount <= 3) {
                        console.log(`等待MediaPipe模型加载... (第 ${window._frameCount} 帧)`);
                    } else if (window._frameCount % 30 === 0) { // 每30帧记录一次
                        console.log(`MediaPipe模型仍在加载中，已尝试 ${window._frameCount} 帧`);
                    }
                } else if (window._frameCount <= 5) {
                    console.log(`发送第 ${window._frameCount} 帧到MediaPipe，视频尺寸: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
                } else if (window._frameCount === 10) {
                    console.log('MediaPipe帧发送正常，继续运行...');
                }
                
                // 如果模型未准备好，降低发送频率（每3帧发送一次）
                if (!handsReady && window._frameCount % 3 !== 0) {
                    frameRequestId = requestAnimationFrame(sendFrameToMediaPipe);
                    return;
                }
                
                hands.send({ image: videoElement })
                    .then(() => {
                        // 发送成功，重置失败计数
                        window._sendFailures = 0;
                    })
                    .catch(error => {
                        // 忽略常见的不重要错误
                        if (!error.message.includes('Canceled') && !error.message.includes('Abort')) {
                            console.warn('发送帧到MediaPipe失败:', error.message || error);
                            
                            // 增加失败计数
                            window._sendFailures = (window._sendFailures || 0) + 1;
                            
                            // 检查错误类型
                            const errorMsg = error.message || error.toString();
                            
                            if (errorMsg.includes('wasm') || errorMsg.includes('instantiate') || errorMsg.includes('WASM')) {
                                console.log('检测到WASM加载问题，暂停发送5秒...');
                                window._pauseUntil = now + 5000; // 暂停5秒
                                
                                if (window._sendFailures > 3) {
                                    console.error('WASM模块加载失败多次，请刷新页面或检查网络连接');
                                }
                            } else if (errorMsg.includes('not initialized') || errorMsg.includes('load')) {
                                console.log('MediaPipe模型未初始化，暂停发送2秒...');
                                window._pauseUntil = now + 2000; // 暂停2秒
                            }
                            
                            // 如果连续失败多次，延长暂停时间
                            if (window._sendFailures > 5) {
                                console.error(`连续失败 ${window._sendFailures} 次，暂停发送10秒`);
                                window._pauseUntil = now + 10000;
                                window._sendFailures = 0; // 重置计数
                            }
                        }
                    });
            } else {
                // 视频未准备好
                if (window._frameCount === undefined || window._frameCount < 3) {
                    console.log('等待视频准备就绪...');
                }
            }
            
            // 继续下一帧（使用较慢的频率如果模型未准备好）
            const delay = handsReady ? 0 : 100; // 模型未准备好时增加延迟
            setTimeout(() => {
                frameRequestId = requestAnimationFrame(sendFrameToMediaPipe);
            }, delay);
        }
        
        // 启动帧循环
        frameRequestId = requestAnimationFrame(sendFrameToMediaPipe);
        
        // 更新UI状态
        startCameraBtn.disabled = true;
        stopCameraBtn.disabled = false;
        cameraStatusText.textContent = '摄像头运行中';
        cameraStatusIndicator.classList.add('active');
        
        console.log('摄像头启动成功，开始手势识别');
        
    } catch (error) {
        console.error('启动摄像头失败:', error);
        let errorMessage = '无法访问摄像头。\n';
        if (error.name === 'NotFoundError') {
            errorMessage += '未找到摄像头设备。';
        } else if (error.name === 'NotAllowedError') {
            errorMessage += '摄像头权限被拒绝。请允许网站访问摄像头。';
        } else if (error.name === 'NotReadableError') {
            errorMessage += '摄像头正被其他应用占用。';
        } else {
            errorMessage += '错误: ' + error.message;
        }
        alert(errorMessage);
        cameraStatusText.textContent = '摄像头访问失败';
    }
}

// 停止摄像头
function stopCamera() {
    // 停止帧循环
    if (frameRequestId) {
        cancelAnimationFrame(frameRequestId);
        frameRequestId = null;
    }
    
    // 停止摄像头流
    if (cameraStream) {
        const tracks = cameraStream.getTracks();
        tracks.forEach(track => track.stop());
        cameraStream = null;
    }
    
    // 清除视频源
    videoElement.srcObject = null;
    
    // 清除画布
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 更新UI状态
    startCameraBtn.disabled = false;
    stopCameraBtn.disabled = true;
    cameraStatusText.textContent = '摄像头已停止';
    cameraStatusIndicator.classList.remove('active');
    
    // 重置手势显示
    updateGestureDisplay('等待手势...', '请启动摄像头并做出手势', 'fas fa-question-circle');
    handsCountElement.textContent = '0';
    confidenceElement.textContent = '0%';
    
    console.log('摄像头已停止');
}

// MediaPipe手部检测结果处理
function onHandsResults(results) {
    // 标记MediaPipe已准备好
    if (!handsReady) {
        handsReady = true;
        console.log('MediaPipe Hands模型已加载，开始手部检测');
    }
    
    // 更新画布尺寸以匹配视频
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    
    // 清除画布
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 绘制视频帧
    canvasCtx.drawImage(
        results.image, 0, 0, canvasElement.width, canvasElement.height
    );
    
    // 如果有检测到手部
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        console.log(`检测到 ${results.multiHandLandmarks.length} 只手`);
        // 更新手部计数和置信度
        handsCountElement.textContent = results.multiHandLandmarks.length.toString();
        if (results.multiHandedness && results.multiHandedness.length > 0) {
            const confidence = results.multiHandedness[0].score;
            confidenceElement.textContent = `${Math.round(confidence * 100)}%`;
        }
        
        // 绘制手部关键点和连接线
        drawHandLandmarks(results.multiHandLandmarks, results.multiHandedness);
        
        // 分析手势并控制音乐
        if (results.multiHandLandmarks.length === 1) {
            analyzeGesture(results.multiHandLandmarks[0]);
        }
    } else {
        // 没有检测到手部
        handsCountElement.textContent = '0';
        confidenceElement.textContent = '0%';
        updateGestureDisplay('未检测到手部', '请将手放在摄像头前', 'fas fa-hand-paper');
    }
    
    canvasCtx.restore();
}

// 绘制手部关键点和连接线
function drawHandLandmarks(landmarks, handedness) {
    // 绘制连接线
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#6c63ff';
    canvasCtx.fillStyle = '#6c63ff';
    
    // 手部连接线定义（MediaPipe Hands模型）
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // 拇指
        [0, 5], [5, 6], [6, 7], [7, 8], // 食指
        [0, 9], [9, 10], [10, 11], [11, 12], // 中指
        [0, 13], [13, 14], [14, 15], [15, 16], // 无名指
        [0, 17], [17, 18], [18, 19], [19, 20], // 小指
        [5, 9], [9, 13], [13, 17] // 手掌
    ];
    
    for (let i = 0; i < landmarks.length; i++) {
        const handLandmarks = landmarks[i];
        
        // 绘制连接线
        for (const [start, end] of connections) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(
                handLandmarks[start].x * canvasElement.width,
                handLandmarks[start].y * canvasElement.height
            );
            canvasCtx.lineTo(
                handLandmarks[end].x * canvasElement.width,
                handLandmarks[end].y * canvasElement.height
            );
            canvasCtx.stroke();
        }
        
        // 绘制关键点
        for (const landmark of handLandmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(
                landmark.x * canvasElement.width,
                landmark.y * canvasElement.height,
                4, 0, 2 * Math.PI
            );
            canvasCtx.fill();
        }
        
        // 显示左右手标签
        if (handedness && handedness[i]) {
            const label = handedness[i].label;
            const labelX = handLandmarks[0].x * canvasElement.width;
            const labelY = handLandmarks[0].y * canvasElement.height - 30;
            
            canvasCtx.fillStyle = label === 'Left' ? '#ff6b6b' : '#4ecdc4';
            canvasCtx.font = '16px Arial';
            canvasCtx.fillText(
                label === 'Left' ? '左手' : '右手',
                labelX, labelY
            );
        }
    }
}

// 分析手势并控制音乐
function analyzeGesture(landmarks) {
    const now = Date.now();
    
    // 手势冷却时间检查
    if (now - lastGestureTime < gestureCooldown) {
        return;
    }
    
    // 计算手势特征
    const isFist = isHandFist(landmarks);
    const isOpenPalm = isHandOpenPalm(landmarks);
    const isVictory = isVictorySign(landmarks);
    const indexFingerUp = isIndexFingerUp(landmarks);
    const handPosition = getHandPosition(landmarks);
    
    // 手势识别逻辑
    if (isOpenPalm) {
        // 张开手掌 - 播放/继续播放
        if (!isPlaying) {
            playMusic();
            updateGestureDisplay('播放', '张开手掌 - 音乐播放中', 'fas fa-play');
            lastGesture = 'play';
            lastGestureTime = now;
        }
    } else if (isFist) {
        // 握拳 - 暂停
        if (isPlaying) {
            pauseMusic();
            updateGestureDisplay('暂停', '握拳 - 音乐已暂停', 'fas fa-pause');
            lastGesture = 'pause';
            lastGestureTime = now;
        }
    } else if (isVictory) {
        // 胜利手势 - 下一曲
        nextTrack();
        updateGestureDisplay('下一曲', '胜利手势 - 切换到下一首曲目', 'fas fa-forward');
        lastGesture = 'next';
        lastGestureTime = now;
    } else if (indexFingerUp) {
        // 食指抬起 - 音量控制
        const indexFingerTip = landmarks[8];
        const middleFingerTip = landmarks[12];
        
        // 计算食指高度（相对于手掌）
        const wrist = landmarks[0];
        const indexFingerHeight = wrist.y - indexFingerTip.y;
        
        // 平滑音量变化
        volumeHistory.push(indexFingerHeight);
        if (volumeHistory.length > 5) volumeHistory.shift();
        
        const avgHeight = volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length;
        
        // 映射到音量范围 (0-1)
        let newVolume = Math.min(Math.max(avgHeight * 5, 0), 1);
        
        // 更新音量
        updateVolumeFromGesture(newVolume);
        
        updateGestureDisplay('音量控制', '食指上下移动调节音量', 'fas fa-volume-up');
        lastGesture = 'volume';
    } else if (handPosition.movement !== 'none') {
        // 手部左右移动 - 播放速度控制
        const handX = handPosition.x;
        
        // 平滑速度变化
        speedHistory.push(handX);
        if (speedHistory.length > 5) speedHistory.shift();
        
        const avgX = speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length;
        
        // 映射到速度范围 (0.5-2.0)
        let newSpeed = 0.5 + (avgX * 1.5);
        newSpeed = Math.min(Math.max(newSpeed, 0.5), 2.0);
        
        // 更新播放速度
        updateSpeedFromGesture(newSpeed);
        
        updateGestureDisplay('速度控制', '手左右移动调节播放速度', 'fas fa-tachometer-alt');
        lastGesture = 'speed';
    } else {
        // 未识别的手势
        updateGestureDisplay('手势识别中', '请做出控制手势', 'fas fa-hand-point-up');
    }
}

// 手势检测辅助函数
function isHandFist(landmarks) {
    // 握拳检测：所有指尖都靠近手掌
    const wrist = landmarks[0];
    const fingertips = [4, 8, 12, 16, 20]; // 拇指尖、食指尖、中指尖、无名指尖、小指尖
    
    let totalDistance = 0;
    for (const tipIndex of fingertips) {
        const tip = landmarks[tipIndex];
        const distance = Math.sqrt(
            Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2)
        );
        totalDistance += distance;
    }
    
    const avgDistance = totalDistance / fingertips.length;
    return avgDistance < 0.15; // 阈值
}

function isHandOpenPalm(landmarks) {
    // 张开手掌检测：所有指尖都远离手掌
    const wrist = landmarks[0];
    const fingertips = [4, 8, 12, 16, 20];
    
    let totalDistance = 0;
    for (const tipIndex of fingertips) {
        const tip = landmarks[tipIndex];
        const distance = Math.sqrt(
            Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2)
        );
        totalDistance += distance;
    }
    
    const avgDistance = totalDistance / fingertips.length;
    return avgDistance > 0.25; // 阈值
}

function isVictorySign(landmarks) {
    // 胜利手势检测：食指和中指抬起，其他手指弯曲
    const indexFingerTip = landmarks[8];
    const indexFingerPip = landmarks[6];
    const middleFingerTip = landmarks[12];
    const middleFingerPip = landmarks[10];
    const ringFingerTip = landmarks[16];
    const ringFingerPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];
    
    // 食指和中指伸直
    const indexStraight = indexFingerTip.y < indexFingerPip.y;
    const middleStraight = middleFingerTip.y < middleFingerPip.y;
    
    // 无名指和小指弯曲
    const ringBent = ringFingerTip.y > ringFingerPip.y;
    const pinkyBent = pinkyTip.y > pinkyPip.y;
    
    // 拇指位置不太重要
    return indexStraight && middleStraight && ringBent && pinkyBent;
}

function isIndexFingerUp(landmarks) {
    // 食指抬起检测
    const indexFingerTip = landmarks[8];
    const indexFingerPip = landmarks[6];
    const middleFingerTip = landmarks[12];
    const middleFingerPip = landmarks[10];
    
    // 食指伸直且高于中指
    const indexStraight = indexFingerTip.y < indexFingerPip.y;
    const indexAboveMiddle = indexFingerTip.y < middleFingerTip.y;
    
    return indexStraight && indexAboveMiddle;
}

function getHandPosition(landmarks) {
    // 获取手部位置和移动方向
    const wrist = landmarks[0];
    
    // 简单的位置追踪
    return {
        x: wrist.x,
        y: wrist.y,
        movement: 'none' // 简化版本，实际应追踪历史位置
    };
}

// 音乐控制函数
function loadTrack(trackIndex) {
    if (trackIndex < 0 || trackIndex >= tracks.length) {
        console.error('无效的曲目索引:', trackIndex);
        return;
    }
    
    const track = tracks[trackIndex];
    currentTrackIndex = trackIndex;
    
    console.log(`加载曲目: ${track.title}，URL: ${track.url}`);
    
    // 更新音频元素源
    audioElement.src = track.url;
    
    // 添加加载事件监听器
    audioElement.addEventListener('loadstart', () => {
        console.log('开始加载音频...');
    });
    
    audioElement.addEventListener('progress', (e) => {
        if (audioElement.duration > 0) {
            const percent = (audioElement.buffered.end(0) / audioElement.duration) * 100;
            console.log(`音频加载进度: ${percent.toFixed(1)}%`);
        }
    });
    
    audioElement.load();
    
    // 更新UI
    updateTrackInfo();
    musicStatus.textContent = '加载中...';
    
    // 启用控制按钮
    enableMusicControls();
    
    // 更新上传音乐列表的活动状态
    updateUploadedTracksList();
}

function playMusic() {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    audioElement.play()
        .then(() => {
            isPlaying = true;
            updateMusicStatus();
            updatePlayPauseButton();
            console.log('音乐开始播放');
        })
        .catch(error => {
            console.error('播放失败:', error);
            musicStatus.textContent = '播放失败';
        });
}

function pauseMusic() {
    audioElement.pause();
    isPlaying = false;
    updateMusicStatus();
    updatePlayPauseButton();
    console.log('音乐已暂停');
}

function togglePlayPause() {
    if (isPlaying) {
        pauseMusic();
    } else {
        playMusic();
    }
}

function stopMusic() {
    audioElement.pause();
    audioElement.currentTime = 0;
    isPlaying = false;
    updateMusicStatus();
    updatePlayPauseButton();
    console.log('音乐已停止');
}

function prevTrack() {
    let newIndex = currentTrackIndex - 1;
    if (newIndex < 0) {
        newIndex = tracks.length - 1; // 循环到最后
    }
    loadTrack(newIndex);
    
    // 如果之前正在播放，继续播放
    if (isPlaying) {
        setTimeout(() => playMusic(), 100);
    }
}

function nextTrack() {
    let newIndex = currentTrackIndex + 1;
    if (newIndex >= tracks.length) {
        newIndex = 0; // 循环到开头
    }
    loadTrack(newIndex);
    
    // 如果之前正在播放，继续播放
    if (isPlaying) {
        setTimeout(() => playMusic(), 100);
    }
}

function updateVolume() {
    const volume = volumeSlider.value / 100;
    if (gainNode) {
        gainNode.gain.value = volume;
    }
    volumeValue.textContent = `${volumeSlider.value}%`;
    console.log(`音量更新: ${volume}`);
}

function updateVolumeFromGesture(volume) {
    // 将手势检测的音量值映射到滑块范围
    const sliderValue = Math.round(volume * 100);
    volumeSlider.value = sliderValue;
    updateVolume();
}

function updateSpeed() {
    playbackRate = speedSlider.value / 100;
    if (audioElement) {
        audioElement.playbackRate = playbackRate;
    }
    speedValue.textContent = `${playbackRate.toFixed(1)}x`;
    console.log(`播放速度更新: ${playbackRate}`);
}

function updateSpeedFromGesture(speed) {
    // 将手势检测的速度值映射到滑块范围
    const sliderValue = Math.round(speed * 100);
    speedSlider.value = sliderValue;
    updateSpeed();
}

// UI更新函数
function updateTrackInfo() {
    const track = tracks[currentTrackIndex];
    trackTitle.textContent = track.title;
    trackArtist.textContent = track.artist;
}

function updateMusicStatus() {
    if (!audioElement.src) {
        musicStatus.textContent = '未加载';
        return;
    }
    
    if (isPlaying) {
        musicStatus.textContent = '播放中';
    } else if (audioElement.currentTime > 0) {
        musicStatus.textContent = '已暂停';
    } else {
        musicStatus.textContent = '已停止';
    }
}

function updateTimeDisplay() {
    if (!audioElement.duration) return;
    
    const current = formatTime(audioElement.currentTime);
    const total = formatTime(audioElement.duration);
    timeDisplay.textContent = `${current} / ${total}`;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updatePlayPauseButton() {
    const icon = playPauseBtn.querySelector('i');
    if (isPlaying) {
        icon.className = 'fas fa-pause';
        playPauseBtn.title = '暂停';
    } else {
        icon.className = 'fas fa-play';
        playPauseBtn.title = '播放';
    }
}

function updateGestureDisplay(name, description, iconClass) {
    gestureName.textContent = name;
    gestureDescription.textContent = description;
    
    const icon = gestureIcon.querySelector('i');
    icon.className = iconClass;
    
    // 添加动画效果
    gestureIcon.style.transform = 'scale(1.1)';
    setTimeout(() => {
        gestureIcon.style.transform = 'scale(1)';
    }, 200);
}

function enableMusicControls() {
    playPauseBtn.disabled = false;
    stopMusicBtn.disabled = false;
    prevTrackBtn.disabled = false;
    nextTrackBtn.disabled = false;
    volumeSlider.disabled = false;
    speedSlider.disabled = false;
}

function disableMusicControls() {
    playPauseBtn.disabled = true;
    stopMusicBtn.disabled = true;
    prevTrackBtn.disabled = true;
    nextTrackBtn.disabled = true;
    volumeSlider.disabled = true;
    speedSlider.disabled = true;
}

// ==================== 文件上传功能 ====================

// 处理文件选择
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    // 检查文件类型
    if (!file.type.startsWith('audio/')) {
        alert('请选择音频文件（MP3、WAV、OGG等）');
        musicFileInput.value = ''; // 清除选择
        return;
    }
    
    // 检查文件大小（限制为50MB）
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
        alert('文件太大，请选择小于50MB的音频文件');
        musicFileInput.value = '';
        return;
    }
    
    selectedFile = file;
    
    // 更新UI显示文件信息
    selectedFileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    // 启用上传按钮
    uploadFileBtn.disabled = false;
    
    console.log(`已选择文件: ${file.name} (${formatFileSize(file.size)})`);
}

// 处理文件上传
function handleFileUpload() {
    if (!selectedFile) {
        alert('请先选择文件');
        return;
    }
    
    // 保存文件信息，因为selectedFile即将被重置
    const file = selectedFile;
    const fileSizeBytes = file.size;
    const fileName = file.name.replace(/\.[^/.]+$/, ""); // 移除扩展名
    const fileExt = file.name.split('.').pop().toLowerCase();
    
    // 创建唯一的ID
    const trackId = 'uploaded-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // 创建对象URL
    const objectUrl = URL.createObjectURL(file);
    
    // 创建曲目对象
    const newTrack = {
        id: trackId,
        title: fileName,
        artist: '本地上传',
        url: objectUrl,
        isUploaded: true,
        fileType: fileExt,
        fileSize: fileSizeBytes,
        fileName: file.name
    };
    
    // 存储到映射中以便管理
    uploadedTracksMap.set(trackId, {
        objectUrl: objectUrl,
        file: file
    });
    
    // 添加到曲目列表
    tracks.push(newTrack);
    
    // 更新上传列表UI
    updateUploadedTracksList();
    
    // 更新计数
    updateUploadedCount();
    
    // 重置文件选择
    musicFileInput.value = '';
    selectedFile = null;
    selectedFileName.textContent = '未选择文件';
    fileSize.textContent = '-';
    uploadFileBtn.disabled = true;
    
    console.log(`已上传音乐: ${fileName} (${formatFileSize(fileSizeBytes)})`);
    
    // 如果当前没有正在播放的音乐，自动切换到新上传的音乐
    if (!audioElement.src || audioElement.src === '') {
        loadTrack(tracks.length - 1);
    }
}

// 清除所有上传的音乐
function clearAllUploads() {
    if (uploadedTracksMap.size === 0) {
        return;
    }
    
    if (!confirm(`确定要删除所有上传的音乐吗？共 ${uploadedTracksMap.size} 首`)) {
        return;
    }
    
    // 释放所有对象URL
    for (const [trackId, data] of uploadedTracksMap) {
        URL.revokeObjectURL(data.objectUrl);
    }
    
    // 清空映射
    uploadedTracksMap.clear();
    
    // 从曲目列表中移除所有上传的音乐
    tracks = tracks.filter(track => !track.isUploaded);
    
    // 如果当前播放的是上传的音乐，切换到第一首示例音乐
    if (currentTrackIndex >= tracks.length) {
        currentTrackIndex = 0;
        loadTrack(currentTrackIndex);
    }
    
    // 更新UI
    updateUploadedTracksList();
    updateUploadedCount();
    updateTrackInfo();
    
    console.log('已清除所有上传的音乐');
}

// 删除单个上传的音乐
function deleteUploadedTrack(trackId) {
    const trackIndex = tracks.findIndex(track => track.id === trackId);
    if (trackIndex === -1) {
        return;
    }
    
    // 释放对象URL
    const trackData = uploadedTracksMap.get(trackId);
    if (trackData) {
        URL.revokeObjectURL(trackData.objectUrl);
        uploadedTracksMap.delete(trackId);
    }
    
    // 从曲目列表中移除
    tracks.splice(trackIndex, 1);
    
    // 如果删除的是当前正在播放的曲目，切换到下一首
    if (currentTrackIndex === trackIndex) {
        if (tracks.length > 0) {
            loadTrack(Math.min(currentTrackIndex, tracks.length - 1));
        } else {
            // 没有曲目了，重置音频
            audioElement.src = '';
            updateTrackInfo();
            updateMusicStatus();
        }
    } else if (currentTrackIndex > trackIndex) {
        // 调整当前曲目索引
        currentTrackIndex--;
    }
    
    // 更新UI
    updateUploadedTracksList();
    updateUploadedCount();
    updateTrackInfo();
}

// 播放指定的上传音乐
function playUploadedTrack(trackId) {
    const trackIndex = tracks.findIndex(track => track.id === trackId);
    if (trackIndex !== -1) {
        loadTrack(trackIndex);
        if (!isPlaying) {
            playMusic();
        }
    }
}

// 更新已上传音乐列表的UI
function updateUploadedTracksList() {
    // 获取所有上传的音乐
    const uploadedTracks = tracks.filter(track => track.isUploaded);
    
    if (uploadedTracks.length === 0) {
        uploadedTracksList.innerHTML = '<div class="empty-message">暂无上传的音乐</div>';
        return;
    }
    
    // 生成列表HTML
    let html = '';
    uploadedTracks.forEach(track => {
        const isActive = tracks[currentTrackIndex] && tracks[currentTrackIndex].id === track.id;
        const activeClass = isActive ? 'active' : '';
        
        html += `
            <div class="uploaded-track-item ${activeClass}" data-track-id="${track.id}">
                <div class="track-item-info">
                    <div class="track-item-title">${track.title}</div>
                    <div class="track-item-details">
                        <span>${track.artist}</span>
                        <span>${track.fileType.toUpperCase()}</span>
                        <span>${formatFileSize(track.fileSize)}</span>
                    </div>
                </div>
                <div class="track-item-actions">
                    <button class="track-action-btn play" title="播放" onclick="playUploadedTrack('${track.id}')">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="track-action-btn delete" title="删除" onclick="deleteUploadedTrack('${track.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    uploadedTracksList.innerHTML = html;
}

// 更新已上传音乐计数
function updateUploadedCount() {
    const count = tracks.filter(track => track.isUploaded).length;
    uploadedCount.textContent = `(${count})`;
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 初始化时更新上传列表
updateUploadedCount();
updateUploadedTracksList();

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// 导出全局函数（用于调试）
window.app = {
    playMusic,
    pauseMusic,
    stopMusic,
    nextTrack,
    prevTrack,
    startCamera,
    stopCamera,
    updateVolume,
    updateSpeed
};