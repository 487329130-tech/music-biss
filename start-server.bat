@echo off
echo 正在启动音乐指挥家本地服务器...
echo.

REM 检查Python是否可用
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo 检测到Python，使用Python启动HTTP服务器...
    python -m http.server 8080
    goto :end
)

where python3 >nul 2>nul
if %errorlevel% equ 0 (
    echo 检测到Python3，使用Python3启动HTTP服务器...
    python3 -m http.server 8080
    goto :end
)

REM 检查Node.js是否可用
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo 检测到Node.js，使用http-server模块...
    echo 如果未安装http-server，请先运行: npm install -g http-server
    http-server -p 8080
    goto :end
)

echo 错误：未找到Python或Node.js。
echo 请安装以下任一环境：
echo 1. Python 3.x (推荐)
echo 2. Node.js (需要安装http-server模块)
echo.
echo 或者，您可以直接在浏览器中打开index.html文件（但摄像头功能可能受限）。
pause

:end