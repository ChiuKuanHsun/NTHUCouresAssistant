NthuCourseModal.showSavedCoursesModal(savedCourses, (indexToRemove) => {
        if (indexToRemove === -1) {
            // 清空全部課程
            savedCourses = [];
            chrome.storage.sync.set({ 'savedCourses': [] }, () => {
                //console.log('所有暫存課程已清空');
                updateSavedListButton();
                // 將所有書籤取消勾選
                const courseTable = document.getElementById('T1');
                if (courseTable) {
                    const rows = courseTable.querySelectorAll('tbody tr');
                    rows.forEach((row, index) => {
                        const bookmarkCheckbox = row.querySelector(`#nthu-helper-bookmark-${index}`);
                        if (bookmarkCheckbox) {
                            bookmarkCheckbox.checked = false;
                        }
                    });
                }
                openSavedCoursesModal(); // 重新渲染 modal 內容
            });
            return;
        }
        const courseToRemove = savedCourses[indexToRemove];
        if (!courseToRemove) return;

        savedCourses.splice(indexToRemove, 1);
        
        chrome.storage.sync.set({ 'savedCourses': savedCourses }, () => {
            //console.log('課程已從暫存移除');
            
            updateSavedListButton();
            
            // --- 【核心 Bug 修正】 ---
            // 直接在主頁面上找到對應的書籤並手動取消勾選，不再重新注入所有按鈕
            const courseTable = document.getElementById('T1');
            if (courseTable) {
                 const rows = courseTable.querySelectorAll('tbody tr');
                 rows.forEach((row, index) => {
                    const idCell = row.cells[1];
                    if (idCell && idCell.innerText.trim() === courseToRemove.id) {
                        const bookmarkCheckbox = row.querySelector(`#nthu-helper-bookmark-${index}`);
                        if (bookmarkCheckbox) {
                            bookmarkCheckbox.checked = false;
                        }
                    }
                 });
            }
            
            openSavedCoursesModal(); // 重新渲染 modal 內容
        });

    }, buttonRect);


