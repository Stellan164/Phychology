// 切换登录和注册表单
let isLogin = true;
const switchForm = () => {
    const preBox = document.querySelector(".pre-box");
    const img = document.querySelector(".img-box img");

    if (isLogin) {
        preBox.style.transform = "translateX(100%)";
        preBox.style.backgroundColor = "#c9e0ed";
        img.src = "/static/image/cat.jpg";
    } else {
        preBox.style.transform = "translateX(0%)";
        preBox.style.backgroundColor = "#edd4dc";
        img.src = "/static/image/cat.jpg";
    }
    isLogin = !isLogin;
};

// 创建泡泡
const createBubble = () => {
    const bubble = document.createElement("div");
    bubble.classList.add("bubble");

    // 随机大小
    const size = Math.random() * 30 + 10; // 10px ~ 40px
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;

    // 随机起始位置
    bubble.style.left = `${Math.random() * window.innerWidth}px`;

    // 随机动画时长
    const duration = Math.random() * 10 + 5; // 5s ~ 15s
    bubble.style.animationDuration = `${duration}s`;

    // 随机透明度
    const opacity = Math.random() * 0.5 + 0.3; // 0.3 ~ 0.8
    bubble.style.opacity = opacity;

    // 添加到页面
    document.body.appendChild(bubble);

    // 动画结束后移除泡泡
    bubble.addEventListener("animationend", () => {
        bubble.remove();
    });
};

// 控制泡泡生成频率和数量
let bubbleCount = 0;
const maxBubbles = 10; // 最多同时存在 10 个泡泡

const generateBubbles = () => {
    if (bubbleCount < maxBubbles) {
        createBubble();
        bubbleCount++;
    }
};

// 使用 requestAnimationFrame 优化泡泡生成
const bubbleAnimation = () => {
    generateBubbles();
    requestAnimationFrame(bubbleAnimation);
};

// 启动泡泡动画
bubbleAnimation();

// 监听泡泡消失事件
document.addEventListener("animationend", (e) => {
    if (e.target.classList.contains("bubble")) {
        bubbleCount--;
    }
});

// 显示加载状态
const showLoading = () => {
    document.getElementById("loading").style.display = "block";
};

// 隐藏加载状态
const hideLoading = () => {
    document.getElementById("loading").style.display = "none";
};

// 表单验证
const validateForm = (fields) => {
    for (const field of fields) {
        if (!field.value.trim()) {
            alert("请填写所有字段");
            return false;
        }
    }
    return true;
};

// 注册功能
const register = async () => {
    const username = document.getElementById("reg-username");
    const password = document.getElementById("reg-password");
    const confirmPassword = document.getElementById("reg-confirm-password");

    // 表单验证
    if (!validateForm([username, password, confirmPassword])) {
        return;
    }

    if (password.value !== confirmPassword.value) {
        alert("两次输入的密码不一致");
        return;
    }

    showLoading(); // 显示加载状态

    try {
        const response = await fetch("/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                username: username.value,
                password: password.value,
                confirm_password: confirmPassword.value,
                activation_code: "#39C5BB", // 固定激活码
            }),
        });

        const data = await response.json();

        if (data.success) {
            alert("注册成功");
            // 清空表单
            username.value = "";
            password.value = "";
            confirmPassword.value = "";
            switchForm(); // 切换到登录表单
        } else {
            alert(data.error || "注册失败");
        }
    } catch (error) {
        alert("网络错误，请稍后重试");
    } finally {
        hideLoading(); // 隐藏加载状态
    }
};

// 登录功能
const login = async () => {
    const username = document.getElementById("login-username");
    const password = document.getElementById("login-password");
    const activationCode = document.getElementById("login-activation-code");

    // 表单验证
    if (!validateForm([username, password, activationCode])) {
        return;
    }

    showLoading(); // 显示加载状态

    try {
        const response = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                username: username.value,
                password: password.value,
                activation_code: activationCode.value,
            }),
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = data.redirect; // 跳转到导航页面
        } else {
            alert(data.error || "登录失败");
        }
    } catch (error) {
        alert("网络错误，请稍后重试");
    } finally {
        hideLoading(); // 隐藏加载状态
    }
};