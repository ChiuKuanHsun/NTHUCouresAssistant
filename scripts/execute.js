window.addEventListener("message", function(event) {
    // 我們只接收來自我們自己擴充功能的訊息
    if (event.source === window && event.data.type && event.data.type === "EXECUTE_ACTION") {
        const { functionName, args } = event.data.payload;

        if (typeof window[functionName] === 'function') {
            console.log(`Executing ${functionName} with args:`, args);
            // 呼叫頁面上的全域函數，例如 checks() 或 syllabus()
            window[functionName](document.form1, ...args);
        } else {
            console.error(`Helper Error: Function ${functionName} not found on page.`);
        }
    }
}, false);