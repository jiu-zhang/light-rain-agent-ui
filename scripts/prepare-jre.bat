@echo off
chcp 65001 >nul
echo ==========================================
echo   LightRain - JRE 准备脚本
echo   使用 jlink 从 JDK 中裁剪出最小 JRE
echo ==========================================
echo.

REM 检查 JAVA_HOME
if "%JAVA_HOME%"=="" (
    echo [错误] 未设置 JAVA_HOME 环境变量
    echo 请先安装 JDK 17+，并设置 JAVA_HOME
    pause
    exit /b 1
)

echo JDK 路径: %JAVA_HOME%
echo.

REM 检查 jlink
if not exist "%JAVA_HOME%\bin\jlink.exe" (
    echo [错误] 未找到 jlink.exe，请确认使用的是 JDK（不是 JRE）
    pause
    exit /b 1
)

REM 输出目录
set OUTPUT_DIR=%~dp0..\resources\runtime

REM 用 jlink 创建最小 JRE（只包含 Spring Boot 所需模块）
echo 正在创建最小 JRE...
"%JAVA_HOME%\bin\jlink" ^
    --module-path "%JAVA_HOME%\jmods" ^
    --add-modules java.base,java.compiler,java.desktop,java.instrument,java.management,java.naming,java.net.http,java.prefs,java.rmi,java.scripting,java.security.jgss,java.security.sasl,java.sql,java.transaction.xa,java.xml,jdk.httpserver,jdk.unsupported,jdk.crypto.ec,jdk.crypto.cryptoki ^
    --output "%OUTPUT_DIR%" ^
    --strip-debug ^
    --no-header-files ^
    --no-man-pages ^
    --compress=2

if %errorlevel% neq 0 (
    echo.
    echo [错误] jlink 执行失败
    pause
    exit /b 1
)

echo.
echo [完成] JRE 已生成到: %OUTPUT_DIR%
echo 体积:
dir /s "%OUTPUT_DIR%" | findstr "File"

echo.
echo 提示: 记得将 resources\runtime 添加到 .gitignore
pause
