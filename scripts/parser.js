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
    parseCourseRow(row, columnIndexes) {
        // 確保所有必要的索引都存在
        const requiredIndexes = ['id', 'name', 'credit', 'time', 'room', 'teacher', 'restrictions'];
        for (const key of requiredIndexes) {
            if (columnIndexes[key] === undefined) {
                console.warn(`解析課程行失敗：找不到 '${key}' 欄位的索引。`);
                return null;
            }
        }
        
        if (row.cells.length < requiredIndexes.length) return null;

        const courseTitleCellText = row.cells[columnIndexes.name].innerText;
        const restrictionsText = row.cells[columnIndexes.restrictions].innerText;

        const isGeCourse = courseTitleCellText.includes('通識') || 
                            courseTitleCellText.includes('GE course');
                             
        const isXClass = restrictionsText.toUpperCase().includes('X-CLASS');

        // Extract GE Category
        let geCategory = null;
        if (courseTitleCellText.includes('核心通識')) {
             // Extract number 1-6
             const match = courseTitleCellText.match(/核心通識\s*(\d)/);
             if (match) {
                 geCategory = `核心通識${match[1]}`;
             } else if (courseTitleCellText.includes('Core GE courses')) {
                 // Fallback to English if Chinese parsing fails but English is present
                 const matchEn = courseTitleCellText.match(/Core GE courses\s*(\d)/);
                 if (matchEn) {
                     geCategory = `核心通識${matchEn[1]}`;
                 }
             }
        } else if (courseTitleCellText.includes('自然科學領域') || courseTitleCellText.includes('Natural')) {
            geCategory = '自然科學領域';
        } else if (courseTitleCellText.includes('社會科學領域') || courseTitleCellText.includes('Social')) {
            geCategory = '社會科學領域';
        } else if (courseTitleCellText.includes('人文學領域') || courseTitleCellText.includes('Humanities')) {
            geCategory = '人文學領域';
        }

        let addActionArgs = null;
        let syllabusActionArgs = null;

        const addButton = row.cells[0].querySelector('input[type="button"][value*="ADD"], input[type="button"][value*="Add"]');
        const syllabusButton = row.cells[row.cells.length - 1].querySelector('input[type="button"][value*="Syllabus"]');
        const geInput = row.cells[0].querySelector('input[type="text"]');


        if (addButton) {
            const onclickAttr = addButton.getAttribute('onclick');
            // 使用正則表達式提取 checks() 函數中的所有參數
            const matches = onclickAttr.match(/checks\((.*?)\)/);
            if (matches && matches[1]) {
                // 將參數字串 'this.form, 'arg1', 'arg2', ...' 轉換為陣列 ['arg1', 'arg2', ...]
                addActionArgs = matches[1].split(',').slice(1).map(arg => arg.trim().replace(/^['"]|['"]$/g, ''));
            }
        } else if (geInput) {
             // 處理通識課的志願序輸入框
             const geButton = row.cells[0].querySelector('input[type="button"][value*="Add"]');
             if(geButton){
                const onclickAttr = geButton.getAttribute('onclick');
                const matches = onclickAttr.match(/checks\((.*?)\)/);
                 if (matches && matches[1]) {
                    addActionArgs = matches[1].split(',').slice(1).map(arg => arg.trim().replace(/^['"]|['"]$/g, ''));
                }
             }
        }


        if (syllabusButton) {
            const onclickAttr = syllabusButton.getAttribute('onclick');
            const matches = onclickAttr.match(/syllabus\((.*?)\)/);
            if (matches && matches[1]) {
                syllabusActionArgs = matches[1].split(',').slice(1).map(arg => arg.trim().replace(/^['"]|['"]$/g, ''));
            }
        }

        return {
            id: row.cells[columnIndexes.id].innerText.trim(),
            name: courseTitleCellText.split('\n')[0].trim(),
            nameEn: courseTitleCellText.split('\n')[1]?.trim() || '',
            credit: row.cells[columnIndexes.credit].innerText.trim(),
            time: this.parseTimeCode(row.cells[columnIndexes.time].innerText.trim()), 
            room: row.cells[columnIndexes.room].innerText.trim(),
            teacher: row.cells[columnIndexes.teacher].innerText.trim(),
            isGe: isGeCourse,
            geCategory: geCategory,
            isXClass: isXClass,
            addActionArgs: addActionArgs,
            syllabusActionArgs: syllabusActionArgs,
            isGeInput: !!geInput, // 標記這是否為一個需要填志願序的通識課
            element: row
        };
    },

    /**
     * 【已修改】解析可加選的課程總表，現在會先動態定位欄位。
     * @param {HTMLTableElement} table - 課程的 <table> 元素。
     * @returns {Array<Object|null>} - 課程物件陣列。
     */
    parseCourseTable(table) {
        // --- 【核心修改】動態尋找欄位索引 ---
        const headerCells = table.querySelectorAll('thead tr td');
        const columnIndexes = {};
        headerCells.forEach((cell, index) => {
            const cellText = cell.innerText;
            if (cellText.includes('科號')) columnIndexes.id = index;
            else if (cellText.includes('科目名稱')) columnIndexes.name = index;
            else if (cellText.includes('學分')) columnIndexes.credit = index;
            else if (cellText.includes('時間')) columnIndexes.time = index;
            else if (cellText.includes('教室')) columnIndexes.room = index;
            else if (cellText.includes('教師')) columnIndexes.teacher = index;
            else if (cellText.includes('限制')) columnIndexes.restrictions = index;
        });

        const courses = [];
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            // 檢查是否是有效的課程行
            if (row.cells.length > 1 && (row.querySelector('input[type="button"]') || row.querySelector('input[type="text"]'))) {
                const course = this.parseCourseRow(row, columnIndexes);
                courses.push(course); // 即使是 null 也推入以保持索引對應
            } else {
                courses.push(null); 
            }
        });
        return courses;
    },

    // 解析已選上的課程列表 (mainFrame)
    parseEnrolledCourses(mainFrameDoc) {
        const enrolledTable = mainFrameDoc.getElementById('T1');
        if (!enrolledTable) return [];

        const headerCells = enrolledTable.querySelectorAll('thead tr td');
        let noteIndex = -1;
        headerCells.forEach((cell, index) => {
            if (cell.innerText.includes('備註')) {
                noteIndex = index;
            }
        });

        // 如果找不到 "備註" 欄，就無法判斷 X-Class，給予警告但繼續執行
        if (noteIndex === -1) {
            console.warn('警告：在已選課程列表中找不到 "備註" 欄，X-Class 衝堂判斷可能不準確。');
        }

        const enrolledCourses = [];
        const rows = enrolledTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            // 檢查是否為有效的課程行
            if (row.cells.length > 4 && row.cells[1].innerText.trim()) {
                const courseId = row.cells[1].innerText.trim();
                const timeString = row.cells[4].innerText.trim();
                const courseTitleCellText = row.cells[2].innerText.trim();
                const isGeCourse = courseTitleCellText.includes('GE course') || 
                                   courseTitleCellText.includes('通識');
                //const noteText = row.cells[10] ? row.cells[10].innerText.trim() : '';
                //const isXClass = noteText.includes('X-Class');
                let isXClass = false;
                // 使用動態索引來取得備註欄位的資料
                if (noteIndex !== -1 && row.cells[noteIndex]) {
                    const noteText = row.cells[noteIndex].innerText;
                    isXClass = noteText.toUpperCase().includes('X-CLASS');
                }

                enrolledCourses.push({
                    id: courseId,
                    name: courseTitleCellText.split('\n')[0].trim(),
                    nameEn: courseTitleCellText.split('\n')[1]?.trim() || '',
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

            const acixstore = window.top.frames['topFrame']?.document.querySelector('input[name="ACIXSTORE"]')?.value;
            if (!acixstore) {
                console.error("無法獲取 ACIXSTORE token。");
                return new Map();
            }

            const formData = new FormData();
            formData.append('ACIXSTORE', acixstore);
            formData.append('select', departmentId);
            formData.append('act', '1');
            formData.append('Submit', 'Submit');

            const url = 'https://www.ccxp.nthu.edu.tw/ccxp/COURSE/JH/7/7.2/7.2.7/JH727002.php';

            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`伺服器錯誤: ${response.status}`);
            }

            const buffer = await response.arrayBuffer();
            const decoder = new TextDecoder('big5');
            const htmlText = decoder.decode(buffer);

            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            
            const headerCells = doc.querySelectorAll('table.sortable tr.class2 td');
            const columnIndexes = {};
            
            headerCells.forEach((cell, index) => {
                const cellText = cell.innerText;
                if (cellText.includes('科號')) {
                    columnIndexes.id = index;
                } else if (cellText.includes('目前選上人數')) {
                    columnIndexes.enrolled = index;
                } else if (cellText.includes('目前待亂數人數')) {
                    columnIndexes.waiting = index;
                }
            });

            // 檢查是否成功找到所有必要的欄位
            if (columnIndexes.id === undefined || columnIndexes.enrolled === undefined || columnIndexes.waiting === undefined) {
                console.error('無法從回傳的 HTML 中定位必要的欄位標頭。');
                return new Map();
            }
            // --- 修改結束 ---

            const courseRows = doc.querySelectorAll('table.sortable tr.word');
            const countsMap = new Map();

            courseRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                // 使用動態索引來取得資料
                if (cells.length > Math.max(columnIndexes.id, columnIndexes.enrolled, columnIndexes.waiting)) {
                    const courseId = cells[columnIndexes.id].textContent.trim().replace(/\s+/g, '');
                    const enrolledText = cells[columnIndexes.enrolled].textContent.trim();
                    const waitingText = cells[columnIndexes.waiting].textContent.trim();
                    
                    const enrolled = parseInt(enrolledText, 10);
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
            return new Map();
        }
        
        /*try {
            console.log(`正在從 Cloudflare 獲取靜態課程資料...`);

            // 1. 【防快取技巧】在網址後面加上時間參數，確保每次都抓到最新的，而不是舊的快取
            const baseUrl = 'https://chiukuanhsun.github.io/NTHU-Course-result-template/';
            const url = `${baseUrl}?t=${new Date().getTime()}`;
            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error(`網路請求失敗: ${response.status}`);
            }

            const buffer = await response.arrayBuffer();
            
            // 2. 【關鍵修改】手動下載的檔案通常已經是 UTF-8 了
            // 如果這裡用 Big5 解碼 UTF-8 的檔案，出來會全是亂碼，當然找不到欄位
            const decoder = new TextDecoder('utf-8'); 
            const htmlText = decoder.decode(buffer);

            // --- 診斷區塊 (如果出錯，請看 Console 這裡印出什麼) ---
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            
            // ---------------------------------------------------

            const headerCells = doc.querySelectorAll('table.sortable tr.class2 td');
            const columnIndexes = {};
            
            headerCells.forEach((cell, index) => {
                // 使用 includes 並且 trim 去除空白，增加容錯率
                const cellText = cell.innerText.trim();
                if (cellText.includes('科號')) {
                    columnIndexes.id = index;
                } else if (cellText.includes('目前選上人數')) {
                    columnIndexes.enrolled = index;
                } else if (cellText.includes('目前待亂數人數')) {
                    columnIndexes.waiting = index;
                }
            });

            // 檢查欄位
            if (columnIndexes.id === undefined || columnIndexes.enrolled === undefined || columnIndexes.waiting === undefined) {
                console.error('【錯誤】無法定位欄位。可能是編碼錯誤或抓錯檔案。');
                console.log('目前偵測到的所有欄位:', Array.from(headerCells).map(c => c.innerText));
                return new Map();
            }

            const courseRows = doc.querySelectorAll('table.sortable tr.word');
            const countsMap = new Map();

            courseRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > Math.max(columnIndexes.id, columnIndexes.enrolled, columnIndexes.waiting)) {
                    const courseId = cells[columnIndexes.id].textContent.trim().replace(/\s+/g, '');
                    const enrolled = parseInt(cells[columnIndexes.enrolled].textContent.trim(), 10);
                    const waiting = parseInt(cells[columnIndexes.waiting].textContent.trim(), 10);

                    if (courseId && !isNaN(enrolled) && !isNaN(waiting)) {
                        countsMap.set(courseId, { enrolled, waiting });
                    }
                }
            });
            
            console.log(`成功解析 ${countsMap.size} 門課程的人數。`);
            return countsMap;

        } catch (error) {
            console.error("執行過程中發生錯誤:", error);
            return new Map();
        }*/
    }

};