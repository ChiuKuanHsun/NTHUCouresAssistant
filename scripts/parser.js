// scripts/parser.js
// 負責從 HTML 頁面解析資料

const NthuCourseParser = {
    // 解析時間代碼 (e.g., "M7M8R6")
    parseTimeCode(timeCode) {
        const dayMap = { 'M': 1, 'T': 2, 'W': 3, 'R': 4, 'F': 5, 'S': 6, 'U': 7 };
        const slots = [];
        // 處理 T1T2F1F2 這種格式
        const regex = /([MTRFWSU])([1-9a-dn])/g;
        let match;
        while ((match = regex.exec(timeCode)) !== null) {
            slots.push({ day: dayMap[match[1]], slot: match[2] });
        }
        return slots;
    },

    // 解析單個課程行 (row)
    parseCourseRow(row) {
        if (row.cells.length < 13) return null;

        const timeString = row.cells[4].innerText.trim();
        const courseTitleCellText = row.cells[2].innerText.trim();
        const isGeCourse = courseTitleCellText.includes('GE course');
        const restrictionsText = row.cells[12].innerText.trim();
        const isXClass = restrictionsText.includes('X-Class');
        return {
            id: row.cells[1].innerText.trim(),
            name: row.cells[2].innerText.split('\n')[0].trim(),
            nameEn: row.cells[2].innerText.split('\n')[1]?.trim() || '',
            credit: row.cells[3].innerText.trim(),
            time: this.parseTimeCode(timeString), // 使用 parseTimeCode
            room: row.cells[5].innerText.trim(),
            teacher: row.cells[6].innerText.trim(),
            isGe: isGeCourse,
            isXClass: isXClass
        };
    },

    // 解析可加選的課程總表 (topFrame)
    parseCourseTable(table) {
        const courses = [];
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            // 檢查是否是有效的課程行 (例如，排除分隔行)
            if (row.cells.length > 1 && row.cells[0].querySelector('input[type="button"]')) {
                const course = this.parseCourseRow(row);
                courses.push(course);
            } else {
                courses.push(null); // 對於非課程行，推入 null 以保持索引對應
            }
        });
        return courses;
    },

    // 解析已選上的課程列表 (mainFrame)
    parseEnrolledCourses(mainFrameDoc) {
        const enrolledTable = mainFrameDoc.getElementById('T1');
        if (!enrolledTable) return [];

        const enrolledCourses = [];
        const rows = enrolledTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            // 檢查是否為有效的課程行
            if (row.cells.length > 4 && row.cells[1].innerText.trim()) {
                const courseId = row.cells[1].innerText.trim();
                const timeString = row.cells[4].innerText.trim();
                const courseTitleCellText = row.cells[2].innerText.trim();
                const isGeCourse = courseTitleCellText.includes('GE course');
                const noteText = row.cells[10] ? row.cells[10].innerText.trim() : '';
                const isXClass = noteText.includes('X-Class');

                enrolledCourses.push({
                    id: courseId,
                    name: courseTitleCellText.split('\n')[0].trim(),
                    time: this.parseTimeCode(timeString),
                    isGe: isGeCourse,
                    isXClass: isXClass
                });
            }
        });
        return enrolledCourses;
    },
    /**
     * 透過 POST 請求獲取指定系所的即時選課人數，並解析回傳的 HTML。
     * @param {string} departmentId - 系所代碼 (例如 'CS', 'EE', 'GEC')
     * @returns {Promise<Map<string, {enrolled: number, waiting: number}>>} - 一個 Map，鍵為科號，值為包含已選和待抽人數的物件。
     */
    async fetchAndParseCounts(departmentId) {
        try {
            console.log(`正在為系所 ${departmentId} 獲取即時人數...`);

            // 1. 從 topFrame 獲取 ACIXSTORE session token
            const acixstore = window.top.frames['topFrame']?.document.querySelector('input[name="ACIXSTORE"]')?.value;
            if (!acixstore) {
                console.error("無法獲取 ACIXSTORE token。");
                return new Map();
            }

            // 2. 準備 POST request 的 FormData
            const formData = new FormData();
            formData.append('ACIXSTORE', acixstore);
            formData.append('select', departmentId);
            formData.append('act', '1');
            formData.append('Submit', 'Submit'); // 這個值不重要

            const url = 'https://www.ccxp.nthu.edu.tw/ccxp/COURSE/JH/7/7.2/7.2.7/JH727002.php';

            // 3. 發送 fetch 請求
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`伺服器錯誤: ${response.status}`);
            }

            // 4. 將回傳的 Big5 編碼 HTML 解碼
            const buffer = await response.arrayBuffer();
            const decoder = new TextDecoder('big5');
            const htmlText = decoder.decode(buffer);

            // 5. 解析 HTML 並提取資料
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const courseRows = doc.querySelectorAll('table.sortable tr.word');
            
            const countsMap = new Map();

            courseRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 8) { // 確保有足夠的欄位
                    // 科號在第 1 個 cell (index 0)
                    const courseId = cells[0].textContent.trim().replace(/\s+/g, '');
                    // 目前選上人數在第 6 個 cell (index 5)
                    const enrolledText = cells[5].textContent.trim();
                    const enrolled = parseInt(enrolledText, 10);
                    // 待亂數人數在第 8 個 cell (index 7)
                    const waitingText = cells[7].textContent.trim();
                    const waiting = parseInt(waitingText, 10);

                    if (courseId && !isNaN(enrolled) && !isNaN(waiting)) {
                        countsMap.set(courseId, { enrolled, waiting });
                    }
                }
            });
            
            console.log(`成功解析 ${countsMap.size} 門課程的人數。`);
            return countsMap;

        } catch (error) {
            console.error("抓取或解析即時人數時發生錯誤:", error);
            return new Map(); // 發生錯誤時回傳空的 Map
        }
    }

};