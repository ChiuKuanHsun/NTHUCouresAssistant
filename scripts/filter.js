// scripts/filter.js
// 處理所有篩選邏輯

const NthuCourseFilter = {

    // 獲取使用者在時間格子上選擇的時間
    getSelectedTimeSlots() {
        const selected = [];
        const slots = document.querySelectorAll('.nthu-helper-time-grid .time-slot.selected');
        slots.forEach(slot => {
            selected.push({
                day: parseInt(slot.dataset.day, 10),
                slot: slot.dataset.slot
            });
        });
        return selected;
    },

    // 檢查課程時間 (course.time) 是否與一個簡單的時間格子列表 (selectedTimes) 衝堂
    isTimeSlotClashing(courseTimes, selectedTimes) {
        if (!selectedTimes || selectedTimes.length === 0) return false;
        for (const courseTime of courseTimes) {
            for (const selectedTime of selectedTimes) {
                if (courseTime.day === selectedTime.day && courseTime.slot === selectedTime.slot) {
                    return true;
                }
            }
        }
        return false;
    },

    // 檢查待選課程是否與已選課程列表衝堂 (包含通識衝堂的複雜邏輯)
    isCourseClashing(courseToCheck, enrolledCourses, allowGeClash, allowXClassClash) {
        if (!enrolledCourses || enrolledCourses.length === 0) return false;

        for (const timeSlot of courseToCheck.time) {
            for (const enrolledCourse of enrolledCourses) {
                for (const enrolledTimeSlot of enrolledCourse.time) {
                    // 檢查時間是否衝突
                    if (timeSlot.day === enrolledTimeSlot.day && timeSlot.slot === enrolledTimeSlot.slot) {

                        //X-Class 衝堂判斷邏輯
                        if (allowXClassClash && (courseToCheck.isXClass || enrolledCourse.isXClass)) {
                            continue; // 跳過此次衝堂判斷，繼續檢查下一個時段
                        }

                        // 如果允許通識衝堂，且兩門課都是通識課，則不算衝堂
                        if (allowGeClash && courseToCheck.isGe && enrolledCourse.isGe) {
                            continue; // 繼續檢查下一個時段，因為這個衝堂被允許了
                        }
                        return true; // 發現衝堂
                    }
                }
            }
        }
        return false; // 沒有發現不可饒恕的衝堂
    },
    
    checkTimeMatch(courseTimes, selectedTimes, isStrict) {
        // 如果沒有選擇任何時間格，則所有課程都通過篩選
        if (selectedTimes.length === 0) {
            return true;
        }
        
        // 如果課程本身沒有時間，則不符合篩選
        if (courseTimes.length === 0) {
            return false;
        }

        if (isStrict) {
            // --- 嚴格模式 ---
            // 條件：課程的所有時間格，都必須在使用者選擇的範圍內，且兩者數量必須完全相等。

            // 1. 數量必須完全相等
            if (courseTimes.length !== selectedTimes.length) {
                return false;
            }

            // 2. 課程的「每一個」時段，都必須能在「被選中的時段」中找到對應。
            // 使用 Set 結構可以優化查找效率
            const selectedSet = new Set(selectedTimes.map(t => `${t.day}-${t.slot}`));
            return courseTimes.every(ct => selectedSet.has(`${ct.day}-${ct.slot}`));

        } else {
            // --- 模糊模式 (目前模式) ---
            // 條件：課程的任一時間格，只要有出現在使用者選擇的範圍內，就視為符合。
            for (const courseTime of courseTimes) {
                for (const selectedTime of selectedTimes) {
                    if (courseTime.day === selectedTime.day && courseTime.slot === selectedTime.slot) {
                        return true; // 只要找到一個匹配就返回 true
                    }
                }
            }
            return false; // 迴圈跑完都沒找到匹配
        }
    },

    // 主篩選函數
    filterAll(table, courses, enrolledCourses) {
        const nameQuery = document.getElementById('nthu-helper-filter-name').value.toLowerCase();
        const teacherQuery = document.getElementById('nthu-helper-filter-teacher').value.toLowerCase();
        const courseNoQuery = document.getElementById('nthu-helper-filter-courseNo').value.toLowerCase();
        const hideClash = document.getElementById('nthu-helper-hide-clash').checked;
        const strictFilter = document.getElementById('nthu-helper-strict-filter').checked;
        const selectedTimes = this.getSelectedTimeSlots();

        const allowGeClashCheckbox = document.getElementById('nthu-helper-allow-ge-clash');
        const allowGeClash = allowGeClashCheckbox ? allowGeClashCheckbox.checked : false;

        const allowXClassClashCheckbox = document.getElementById('nthu-helper-allow-xclass-clash');
        const allowXClassClash = allowXClassClashCheckbox ? allowXClassClashCheckbox.checked : false;

        const rows = table.querySelectorAll('tbody tr');

        courses.forEach((course, index) => {
            const row = rows[index];
            if (!row || !course) return;

            const nameMatch = !nameQuery || course.name.toLowerCase().includes(nameQuery) || course.nameEn.toLowerCase().includes(nameQuery);
            const teacherMatch = !teacherQuery || course.teacher.toLowerCase().includes(teacherQuery);
            const courseNoMatch = !courseNoQuery || course.id.toLowerCase().includes(courseNoQuery);
            

            const timeSelectMatch = this.checkTimeMatch(course.time, selectedTimes, strictFilter);
            // 注意：時間格子的邏輯是「OR」，只要課程時間包含任一被選中的格子，就符合條件
            //const timeSelectMatch = selectedTimes.length === 0 || this.isTimeSlotClashing(course.time, selectedTimes);
            
            // 衝堂邏輯是「AND」，不能與已選課程衝堂
            const clashMatch = !hideClash || !this.isCourseClashing(course, enrolledCourses, allowGeClash, allowXClassClash);

            if (nameMatch && teacherMatch && courseNoMatch && timeSelectMatch && clashMatch) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
};