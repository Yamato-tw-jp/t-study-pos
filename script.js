const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_VIEW = 'home';
const VIEW_TITLES = {
    home: 'ホーム',
    interview: '面談予約',
    assignments: '課題提出',
    scores: 'テスト成績',
    schedule: '学習スケジュール',
    settings: '設定',
    'teacher-home': '管理ホーム',
    'teacher-students': '生徒管理',
    'teacher-assignments': '課題管理',
    'teacher-schedule': '予定送信'
};

let appData = {
    appTitle: '',
    courseOptions: [],
    gradeOptions: [],
    testTypeOptions: [],
    subjectOptionsByGrade: {},
    menuItems: []
};

const elements = {
    body: document.body,
    loginScreen: document.querySelector('#login-screen'),
    loginForm: document.querySelector('#login-form'),
    loginError: document.querySelector('#login-error'),
    studentId: document.querySelector('#student-id'),
    studentPassword: document.querySelector('#student-password'),
    appTitle: document.querySelector('#app-title'),
    greeting: document.querySelector('#greeting'),
    pageSubtitle: document.querySelector('#page-subtitle'),
    userGoal: document.querySelector('#user-goal'),
    logoutButton: document.querySelector('#logout-button'),
    sidebar: document.querySelector('#sidebar'),
    sidebarToggle: document.querySelector('#sidebar-toggle'),
    sidebarMenu: document.querySelector('#sidebar-menu'),
    viewRoot: document.querySelector('#view-root')
};

let currentRole = '';
let currentStudent = null;
let currentTeacher = null;
let teacherData = null;
let currentView = DEFAULT_VIEW;
let timeoutTimer = null;
let activityTimer = null;

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || '通信に失敗しました。');
    }

    return data;
}

function applyAppData(data) {
    appData = data.app;
    currentRole = data.role;
    currentStudent = data.student || null;
    currentTeacher = data.teacher || null;
    teacherData = data.teacherData || null;
}

function getViewFromHash() {
    const view = window.location.hash.replace('#', '') || DEFAULT_VIEW;
    return VIEW_TITLES[view] ? view : DEFAULT_VIEW;
}

function scheduleAutoLogout() {
    window.clearTimeout(timeoutTimer);
    timeoutTimer = window.setTimeout(() => {
        logout('30分以上操作がなかったため、再度ログインしてください。');
    }, SESSION_TIMEOUT_MS);
}

function createElement(tagName, className = '', text = '') {
    const element = document.createElement(tagName);

    if (className) {
        element.className = className;
    }

    if (text) {
        element.textContent = text;
    }

    return element;
}

function createMenuItem(item) {
    const listItem = document.createElement('li');
    const link = document.createElement('a');

    link.href = item.href;
    link.textContent = item.label;
    link.dataset.view = item.id;

    if (item.id === currentView) {
        link.classList.add('active');
    }

    link.addEventListener('click', () => {
        currentView = item.id;
        elements.sidebar.classList.remove('is-open');
        refreshSessionActivity();
    });

    listItem.append(link);
    return listItem;
}

function renderSidebar() {
    elements.appTitle.textContent = appData.appTitle;
    elements.sidebarMenu.replaceChildren(...appData.menuItems.map(createMenuItem));
}

function getDisplayName(student) {
    return student.settings?.displayName || `${student.name}さん`;
}

function renderHeader() {
    if (currentRole === 'teacher') {
        elements.greeting.textContent = VIEW_TITLES[currentView] || VIEW_TITLES['teacher-home'];
        elements.pageSubtitle.textContent = `${currentTeacher.name}の管理画面です`;
        elements.userGoal.textContent = `${currentTeacher.roleLabel}：${currentTeacher.subject}`;
        return;
    }

    const displayName = getDisplayName(currentStudent);

    elements.greeting.textContent = currentView === DEFAULT_VIEW
        ? `こんにちは、${displayName}`
        : VIEW_TITLES[currentView];
    elements.pageSubtitle.textContent = currentView === DEFAULT_VIEW
        ? currentStudent.subtitle
        : `${displayName}の${VIEW_TITLES[currentView]}を表示しています`;
    elements.userGoal.textContent = `目標：${currentStudent.goal}`;
}

function updateActiveMenu() {
    document.querySelectorAll('.menu a').forEach((menuLink) => {
        menuLink.classList.toggle('active', menuLink.dataset.view === currentView);
    });
}

function createProgressItem(item) {
    const progressItem = createElement('div', 'progress-item');
    const progressLabel = createElement('div', 'progress-label');
    const subject = createElement('span', '', item.subject);
    const percent = createElement('span', '', `${Math.max(0, Math.min(100, item.percent))}%`);
    const progressBarBg = createElement('div', 'progress-bar-bg');
    const progressBarFill = createElement('div', 'progress-bar-fill');
    const safePercent = Math.max(0, Math.min(100, item.percent));

    progressBarFill.style.width = `${safePercent}%`;
    progressLabel.append(subject, percent);
    progressBarBg.append(progressBarFill);
    progressItem.append(progressLabel, progressBarBg);

    return progressItem;
}

function createScheduleItem(item) {
    const listItem = document.createElement('li');
    const date = createElement('span', 'date', item.date);
    const event = createElement('span', 'event', item.event);

    listItem.append(date, event);
    return listItem;
}

function createNewsItem(item) {
    const listItem = document.createElement('li');
    const link = document.createElement('a');

    link.href = item.href;
    link.textContent = item.title;

    listItem.append(link);
    return listItem;
}

function createCard(title, children = []) {
    const card = createElement('section', 'card');
    const heading = createElement('h3', '', title);

    card.append(heading, ...children);
    return card;
}

function renderHomeView(student) {
    const grid = createElement('div', 'dashboard-grid');
    const progressList = document.createElement('div');
    const scheduleList = createElement('ul', 'schedule-list');
    const newsList = createElement('ul', 'news-list');

    progressList.replaceChildren(...student.progressItems.map(createProgressItem));
    scheduleList.replaceChildren(...student.schedules.map(createScheduleItem));
    newsList.replaceChildren(...student.newsItems.map(createNewsItem));

    grid.append(
        createCard('今週の課題進度', [progressList]),
        createCard('直近のスケジュール', [scheduleList]),
        createCard('塾からのお知らせ', [newsList])
    );

    return grid;
}

function createLessonCard(lesson) {
    const card = createElement('article', 'lesson-card');
    const header = createElement('div', 'lesson-card-header');
    const meta = createElement('div', 'lesson-meta');
    const title = createElement('h3', '', lesson.title);
    const status = createElement('span', 'status-pill', lesson.status);
    const details = createElement('p', '', `${lesson.subject}・${lesson.teacher}・${lesson.duration}`);
    const progress = createProgressItem({ subject: '受講進度', percent: lesson.progress });
    const button = createElement('button', 'primary-action', lesson.progress > 0 ? '続きから受講' : '受講を開始');

    header.append(title, status);
    meta.append(details);
    card.append(header, meta, progress, button);

    return card;
}

function renderLessonsView(student) {
    const view = createElement('div', 'content-stack');
    const summary = createElement('div', 'summary-band');
    const remaining = student.lessons.filter((lesson) => lesson.progress < 100).length;
    const list = createElement('div', 'lesson-grid');

    summary.append(
        createElement('div', 'summary-item', `受講予定 ${student.lessons.length}講座`),
        createElement('div', 'summary-item', `未完了 ${remaining}講座`)
    );
    list.replaceChildren(...student.lessons.map(createLessonCard));
    view.append(summary, list);

    return view;
}

function renderScoresView(student) {
    const stack = createElement('div', 'settings-stack');

    stack.append(
        createCard('成績入力', [createScoreForm(student)]),
        createCard('成績一覧', [createScoreTable(student.scoreReports)])
    );

    return stack;
}

function getAssignmentStatusLabel(status) {
    const labels = {
        assigned: '未提出',
        submitted: '提出済み',
        returned: '返却済み'
    };

    return labels[status] || '未提出';
}

function createAssignmentStatus(status) {
    const badge = createElement('span', `status-pill assignment-status assignment-status-${status}`, getAssignmentStatusLabel(status));
    return badge;
}

function createAssignmentSubmitForm(assignment) {
    const form = createElement('form', 'assignment-submit-form');
    const fileInput = document.createElement('input');
    const message = createElement('p', 'form-message');
    const button = createElement('button', 'primary-action', assignment.status === 'submitted' ? '再提出する' : '写真を提出');

    fileInput.name = 'photo';
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.required = true;
    fileInput.setAttribute('capture', 'environment');
    message.id = `assignment-message-${assignment.id}`;
    form.dataset.assignmentId = assignment.id;
    form.append(createFormField('課題写真', fileInput), message, button);
    form.addEventListener('submit', handleAssignmentSubmit);

    return form;
}

function createAssignmentCard(assignment) {
    const card = createElement('article', 'assignment-card');
    const header = createElement('div', 'assignment-card-header');
    const titleBlock = createElement('div', 'assignment-title-block');
    const meta = createElement('p', 'assignment-meta', `${assignment.subject}・提出期限 ${assignment.dueDate}`);
    const instructions = createElement('p', 'assignment-instructions', assignment.instructions);

    titleBlock.append(createElement('h3', '', assignment.title), meta);
    header.append(titleBlock, createAssignmentStatus(assignment.status));
    card.append(header, instructions);

    const photoSrc = assignment.photoUrl || assignment.photoDataUrl;

    if (photoSrc) {
        const image = document.createElement('img');
        image.className = 'assignment-photo';
        image.src = photoSrc;
        image.alt = `${assignment.title}の提出写真`;
        card.append(image);
    }

    if (assignment.status === 'returned') {
        const feedback = createElement('div', 'assignment-feedback');
        feedback.append(
            createElement('strong', '', `評価：${assignment.evaluation}`),
            createElement('p', '', assignment.feedback)
        );
        card.append(feedback);
    } else {
        card.append(createAssignmentSubmitForm(assignment));
    }

    return card;
}

function renderAssignmentsView(student) {
    const stack = createElement('div', 'content-stack');
    const summary = createElement('div', 'summary-band assignment-summary');
    const list = createElement('div', 'assignment-list');
    const assignments = student.assignments || [];
    const waiting = assignments.filter((assignment) => assignment.status === 'assigned').length;
    const submitted = assignments.filter((assignment) => assignment.status === 'submitted').length;
    const returned = assignments.filter((assignment) => assignment.status === 'returned').length;

    summary.append(
        createTeacherSummaryCard('未提出', `${waiting}件`),
        createTeacherSummaryCard('提出済み', `${submitted}件`),
        createTeacherSummaryCard('返却済み', `${returned}件`)
    );

    if (assignments.length) {
        list.replaceChildren(...assignments.map(createAssignmentCard));
    } else {
        list.append(createElement('p', 'empty-state', '現在、提出が必要な課題はありません。'));
    }

    stack.append(summary, list);
    return stack;
}

function getSubjectGroupForStudent(student) {
    const grade = student.settings.grade;

    if (grade.startsWith('中学')) {
        return 'middle';
    }

    if (grade === '高校1年') {
        return 'high1';
    }

    if (grade === '高校2年') {
        return 'high2';
    }

    return 'high3';
}

function getSubjectsForStudent(student) {
    return appData.subjectOptionsByGrade[getSubjectGroupForStudent(student)] || [];
}

function createTestTypeSelect() {
    const select = document.createElement('select');

    select.name = 'testType';
    appData.testTypeOptions.forEach((type) => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.append(option);
    });

    return select;
}

function createScoreInput(name, placeholder = '') {
    const input = document.createElement('input');

    input.name = name;
    input.type = 'number';
    input.min = '0';
    input.placeholder = placeholder;

    return input;
}

function createScoreEntryRow(subject = '', custom = false) {
    const row = createElement('div', 'score-entry-row');
    const subjectField = custom
        ? createTextInput('subject', '', 'text')
        : createElement('span', 'score-subject', subject);

    row.dataset.subject = subject;
    row.dataset.custom = String(custom);

    if (custom) {
        subjectField.placeholder = 'その他教科名';
        subjectField.required = false;
    }

    row.append(
        subjectField,
        createScoreInput('score', '点数'),
        createScoreInput('averageScore', '平均点'),
        createScoreInput('gradeRank', '順位')
    );

    return row;
}

function createScoreForm(student) {
    const form = createElement('form', 'score-form');
    const controls = createElement('div', 'score-form-controls');
    const grid = createElement('div', 'score-entry-grid');
    const header = createElement('div', 'score-entry-row score-entry-header');
    const message = createElement('p', 'form-message');
    const subjects = getSubjectsForStudent(student);

    form.id = 'score-report-form';
    message.id = 'score-report-message';

    controls.append(createFormField('テスト分類', createTestTypeSelect()));
    header.append(
        createElement('span', '', '教科'),
        createElement('span', '', '点数'),
        createElement('span', '', '平均点'),
        createElement('span', '', '学年順位')
    );
    grid.append(header, ...subjects.map((subject) => createScoreEntryRow(subject)));

    for (let index = 0; index < 3; index += 1) {
        grid.append(createScoreEntryRow('', true));
    }

    form.append(
        controls,
        grid,
        message,
        createElement('button', 'primary-action', '成績を保存')
    );
    form.addEventListener('submit', handleScoreSubmit);

    return form;
}

function createScoreTable(reports) {
    const table = createElement('div', 'data-table');
    const header = createElement('div', 'table-row table-header score-table-row');

    ['分類', '教科', '点数', '平均点', '学年順位'].forEach((label) => {
        header.append(createElement('div', '', label));
    });

    table.append(header);

    if (!reports.length) {
        const empty = createElement('div', 'empty-state', 'まだ成績が登録されていません。');
        table.append(empty);
        return table;
    }

    reports.forEach((report) => {
        const row = createElement('div', 'table-row score-table-row');
        row.append(
            createElement('div', '', report.testType),
            createElement('div', '', report.subject),
            createElement('div', '', `${report.score}点`),
            createElement('div', '', `${report.averageScore}点`),
            createElement('div', '', `${report.gradeRank}位`)
        );
        table.append(row);
    });

    return table;
}

function renderScheduleView(student) {
    const timeline = createElement('div', 'timeline-list');

    student.scheduleDetails.forEach((item) => {
        const row = createElement('article', 'timeline-item');
        const date = createElement('div', 'timeline-date', `${item.date} ${item.time}`);
        const body = createElement('div', 'timeline-body');
        body.append(createElement('h3', '', item.title), createElement('p', '', item.place));
        row.append(date, body);
        timeline.append(row);
    });

    return createCard('予定一覧', [timeline]);
}

function createInterviewTopicSelect() {
    const select = document.createElement('select');
    const topics = [
        '定期面談',
        '進路相談'
    ];

    select.name = 'topic';
    topics.forEach((topic) => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        select.append(option);
    });

    return select;
}

function createInterviewDateInput() {
    const input = document.createElement('input');

    input.name = 'date';
    input.type = 'date';
    input.required = true;

    return input;
}

function formatInterviewTime(value) {
    const hour = Math.floor(Number(value));
    const minutes = Number(value) % 1 === 0 ? '00' : '30';

    if (hour === 24) {
        return '24:00';
    }

    return `${String(hour).padStart(2, '0')}:${minutes}`;
}

function createInterviewTimeSlider() {
    const wrapper = createElement('div', 'time-slider-field');
    const input = document.createElement('input');
    const value = createElement('strong', 'time-slider-value', '18:00');

    input.name = 'timeRange';
    input.type = 'range';
    input.min = '15';
    input.max = '24';
    input.step = '0.5';
    input.value = '18';

    input.addEventListener('input', () => {
        value.textContent = formatInterviewTime(input.value);
    });

    wrapper.append(input, value);
    return wrapper;
}

function renderInterviewView(student) {
    const stack = createElement('div', 'settings-stack');
    const form = createElement('form', 'settings-form');
    const message = createElement('p', 'form-message');
    const recentSchedule = createElement('ul', 'schedule-list');

    form.id = 'interview-reservation-form';
    message.id = 'interview-reservation-message';
    form.append(
        createFormField('希望日', createInterviewDateInput()),
        createFormField('希望時間', createInterviewTimeSlider()),
        createFormField('面談内容', createInterviewTopicSelect()),
        createFormField('補足', createTextArea('note')),
        message,
        createElement('button', 'primary-action', '面談を予約')
    );
    form.addEventListener('submit', handleInterviewSubmit);

    recentSchedule.replaceChildren(...student.schedules.slice(0, 3).map(createScheduleItem));
    stack.append(
        createCard('面談予約フォーム', [form]),
        createCard('直近の予定', [recentSchedule])
    );

    return stack;
}

function createFormField(labelText, input) {
    const field = createElement('label', 'form-field');
    const label = createElement('span', '', labelText);

    field.append(label, input);
    return field;
}

function createTextInput(name, value, type = 'text') {
    const input = document.createElement('input');

    input.name = name;
    input.type = type;
    input.value = value || '';
    input.required = true;

    return input;
}

function createTextArea(name, value = '') {
    const textarea = document.createElement('textarea');

    textarea.name = name;
    textarea.value = value;
    textarea.rows = 4;

    return textarea;
}

function createCourseSelect(selectedCourse) {
    const select = document.createElement('select');

    select.name = 'course';
    appData.courseOptions.forEach((course) => {
        const option = document.createElement('option');
        option.value = course;
        option.textContent = course;
        option.selected = course === selectedCourse;
        select.append(option);
    });

    return select;
}

function createGradeSelect(selectedGrade) {
    const select = document.createElement('select');

    select.name = 'grade';
    appData.gradeOptions.forEach((grade) => {
        const option = document.createElement('option');
        option.value = grade;
        option.textContent = grade;
        option.selected = grade === selectedGrade;
        select.append(option);
    });

    return select;
}

function renderSettingsView(student) {
    const stack = createElement('div', 'settings-stack');
    const profileForm = createElement('form', 'settings-form');
    const passwordForm = createElement('form', 'settings-form');
    const profileMessage = createElement('p', 'form-message');
    const passwordMessage = createElement('p', 'form-message');
    const notificationSelect = document.createElement('select');

    profileForm.id = 'settings-profile-form';
    passwordForm.id = 'settings-password-form';
    profileMessage.id = 'settings-profile-message';
    passwordMessage.id = 'settings-password-message';

    [
        ['true', '受け取る'],
        ['false', '受け取らない']
    ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = String(student.settings.notifications) === value;
        notificationSelect.append(option);
    });
    notificationSelect.name = 'notifications';

    profileForm.append(
        createFormField('表示名', createTextInput('displayName', student.settings.displayName)),
        createFormField('登録メール', createTextInput('registeredEmail', student.settings.registeredEmail, 'email')),
        createFormField('保護者メール', createTextInput('parentEmail', student.settings.parentEmail, 'email')),
        createFormField('学年', createGradeSelect(student.settings.grade)),
        createFormField('受講コース', createCourseSelect(student.settings.course)),
        createFormField('通知', notificationSelect),
        profileMessage,
        createElement('button', 'primary-action', '設定を保存')
    );

    passwordForm.append(
        createFormField('現在のパスワード', createTextInput('currentPassword', '', 'password')),
        createFormField('新しいパスワード', createTextInput('newPassword', '', 'password')),
        passwordMessage,
        createElement('button', 'primary-action', 'パスワードを変更')
    );

    profileForm.addEventListener('submit', handleSettingsSubmit);
    passwordForm.addEventListener('submit', handlePasswordSubmit);

    stack.append(
        createCard('アカウント設定', [profileForm]),
        createCard('パスワード変更', [passwordForm])
    );

    return stack;
}

function createTeacherSummaryCard(label, value) {
    const item = createElement('div', 'summary-item');
    item.append(createElement('span', 'summary-label', label), createElement('strong', '', value));
    return item;
}

function createTeacherStudentRow(student) {
    const row = createElement('div', 'table-row teacher-student-row');

    row.append(
        createElement('div', '', student.displayName),
        createElement('div', '', student.grade),
        createElement('div', '', student.course),
        createElement('div', '', `${student.averageProgress}%`),
        createElement('div', '', `${student.activeLessons}件`),
        createElement('div', '', student.nextSchedule)
    );

    return row;
}

function createTeacherStudentsTable(students) {
    const table = createElement('div', 'data-table teacher-table');
    const header = createElement('div', 'table-row table-header teacher-student-row');

    ['生徒', '学年', '受講コース', '平均進捗', '未完了課題', '直近予定'].forEach((label) => {
        header.append(createElement('div', '', label));
    });

    table.append(header, ...students.map(createTeacherStudentRow));
    return table;
}

function renderTeacherHomeView(data) {
    const view = createElement('div', 'content-stack');
    const summary = createElement('div', 'summary-band teacher-summary');

    summary.append(
        createTeacherSummaryCard('生徒数', `${data.summary.studentCount}名`),
        createTeacherSummaryCard('平均進捗', `${data.summary.averageProgress}%`),
        createTeacherSummaryCard('未完了課題', `${data.summary.activeLessons}件`)
    );

    view.append(summary, createCard('課題状況サマリー', [createTeacherStudentsTable(data.students)]));
    return view;
}

function renderTeacherStudentsView(data) {
    return createCard('生徒別 課題状況', [createTeacherStudentsTable(data.students)]);
}

function createEvaluationSelect(selectedValue = '') {
    const select = document.createElement('select');

    select.name = 'evaluation';
    ['A', 'B', 'C', '再提出'].forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        option.selected = value === selectedValue;
        select.append(option);
    });

    return select;
}

function createTeacherStudentSelect(students) {
    const select = document.createElement('select');
    const allOption = document.createElement('option');

    select.name = 'targetStudentId';
    allOption.value = 'all';
    allOption.textContent = '全生徒に送信';
    select.append(allOption);

    students.forEach((student) => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${student.displayName}（${student.grade}）`;
        select.append(option);
    });

    return select;
}

function createTeacherAssignmentForm(data) {
    const form = createElement('form', 'settings-form');
    const message = createElement('p', 'form-message');

    form.id = 'teacher-assignment-form';
    message.id = 'teacher-assignment-message';
    form.append(
        createFormField('送信先', createTeacherStudentSelect(data.students)),
        createFormField('教科', createTextInput('subject', '英語')),
        createFormField('課題名', createTextInput('title', '長文読解プリント')),
        createFormField('提出期限', createTextInput('dueDate', '金曜 21:00')),
        createFormField('指示', createTextArea('instructions', '解いたページ全体が見えるように写真で提出してください。')),
        message,
        createElement('button', 'primary-action', '課題を送信')
    );
    form.addEventListener('submit', handleTeacherAssignmentSubmit);

    return form;
}

function createTeacherAssignmentCard(assignment) {
    const card = createElement('article', 'assignment-card teacher-assignment-card');
    const header = createElement('div', 'assignment-card-header');
    const titleBlock = createElement('div', 'assignment-title-block');
    const message = createElement('p', 'form-message');

    titleBlock.append(
        createElement('h3', '', assignment.title),
        createElement('p', 'assignment-meta', `${assignment.studentName}・${assignment.subject}・提出期限 ${assignment.dueDate}`)
    );
    header.append(titleBlock, createAssignmentStatus(assignment.status));
    card.append(header, createElement('p', 'assignment-instructions', assignment.instructions));

    if (assignment.submittedAt) {
        card.append(createElement('p', 'assignment-meta', `提出日時：${assignment.submittedAt}`));
    }

    const photoSrc = assignment.photoUrl || assignment.photoDataUrl;

    if (photoSrc) {
        const image = document.createElement('img');
        image.className = 'assignment-photo';
        image.src = photoSrc;
        image.alt = `${assignment.studentName}の提出写真`;
        card.append(image);
    }

    if (assignment.status === 'submitted') {
        const form = createElement('form', 'settings-form evaluation-form');

        message.id = `teacher-assignment-message-${assignment.studentId}-${assignment.id}`;
        form.dataset.studentId = assignment.studentId;
        form.dataset.assignmentId = assignment.id;
        form.append(
            createFormField('評価', createEvaluationSelect()),
            createFormField('返却コメント', createTextArea('feedback')),
            message,
            createElement('button', 'primary-action', '評価して返却')
        );
        form.addEventListener('submit', handleTeacherEvaluationSubmit);
        card.append(form);
    } else if (assignment.status === 'returned') {
        const feedback = createElement('div', 'assignment-feedback');
        feedback.append(
            createElement('strong', '', `評価：${assignment.evaluation}`),
            createElement('p', '', assignment.feedback)
        );
        card.append(feedback);
    }

    return card;
}

function renderTeacherAssignmentsView(data) {
    const stack = createElement('div', 'settings-stack');
    const assignmentList = createElement('div', 'assignment-list');

    if (data.assignments.length) {
        assignmentList.replaceChildren(...data.assignments.map(createTeacherAssignmentCard));
    } else {
        assignmentList.append(createElement('p', 'empty-state', 'まだ課題はありません。'));
    }

    stack.append(
        createCard('課題を送信', [createTeacherAssignmentForm(data)]),
        createCard('提出・返却管理', [assignmentList])
    );

    return stack;
}

function renderTeacherScheduleView(data) {
    const stack = createElement('div', 'settings-stack');
    const form = createElement('form', 'settings-form');
    const message = createElement('p', 'form-message');

    form.id = 'teacher-schedule-form';
    message.id = 'teacher-schedule-message';
    form.append(
        createFormField('送信先', createTeacherStudentSelect(data.students)),
        createFormField('日付', createTextInput('date', '来週月曜')),
        createFormField('時刻', createTextInput('time', '18:00')),
        createFormField('内容', createTextInput('title', '確認テスト')),
        createFormField('場所', createTextInput('place', '1番教室')),
        message,
        createElement('button', 'primary-action', '予定を送信')
    );
    form.addEventListener('submit', handleTeacherScheduleSubmit);

    stack.append(
        createCard('学習スケジュール送信', [form]),
        createCard('送信対象の生徒', [createTeacherStudentsTable(data.students)])
    );

    return stack;
}

function renderCurrentView() {
    if (!currentStudent && !currentTeacher) {
        return;
    }

    const studentViews = {
        home: renderHomeView,
        interview: renderInterviewView,
        assignments: renderAssignmentsView,
        scores: renderScoresView,
        schedule: renderScheduleView,
        settings: renderSettingsView
    };
    const teacherViews = {
        'teacher-home': renderTeacherHomeView,
        'teacher-students': renderTeacherStudentsView,
        'teacher-assignments': renderTeacherAssignmentsView,
        'teacher-schedule': renderTeacherScheduleView
    };
    const views = currentRole === 'teacher' ? teacherViews : studentViews;
    const defaultView = currentRole === 'teacher' ? 'teacher-home' : DEFAULT_VIEW;
    const renderView = views[currentView] || views[defaultView];

    elements.viewRoot.replaceChildren(renderView(currentRole === 'teacher' ? teacherData : currentStudent));
    renderHeader();
    updateActiveMenu();
}

function showDashboard() {
    const requestedView = getViewFromHash();
    const teacherView = currentRole === 'teacher' && requestedView.startsWith('teacher-');
    const studentView = currentRole === 'student' && !requestedView.startsWith('teacher-');

    currentView = teacherView || studentView
        ? requestedView
        : currentRole === 'teacher' ? 'teacher-home' : DEFAULT_VIEW;
    elements.body.classList.remove('is-locked');
    elements.loginScreen.hidden = true;
    elements.sidebar.setAttribute('aria-hidden', 'false');
    elements.loginError.textContent = '';
    renderSidebar();
    renderCurrentView();
    scheduleAutoLogout();
}

function showLogin(message = '') {
    currentRole = '';
    currentStudent = null;
    currentTeacher = null;
    teacherData = null;
    elements.body.classList.add('is-locked');
    elements.loginScreen.hidden = false;
    elements.sidebar.setAttribute('aria-hidden', 'true');
    elements.loginError.textContent = message;
    elements.studentPassword.value = '';
    elements.studentId.focus();
    window.clearTimeout(timeoutTimer);
}

async function login(studentId, password) {
    const data = await requestJson('/api/login', {
        method: 'POST',
        body: JSON.stringify({ studentId, password })
    });

    applyAppData(data);
    showDashboard();
}

async function logout(message = '') {
    try {
        await requestJson('/api/logout', { method: 'POST' });
    } catch {
        // Even if the network request fails, the local screen should lock immediately.
    }

    showLogin(message);
}

async function refreshSessionActivity() {
    if ((!currentStudent && !currentTeacher) || activityTimer) {
        return;
    }

    activityTimer = window.setTimeout(() => {
        activityTimer = null;
    }, 10000);

    try {
        await requestJson('/api/activity', { method: 'POST' });
        scheduleAutoLogout();
    } catch {
        showLogin('ログインの有効期限が切れました。再度ログインしてください。');
    }
}

function getFormValues(form) {
    return Object.fromEntries(new FormData(form).entries());
}

function setFormMessage(element, message, type = 'success') {
    element.textContent = message;
    element.dataset.type = type;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('写真を読み込めませんでした。'));
        reader.readAsDataURL(file);
    });
}

async function handleSettingsSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const message = form.querySelector('#settings-profile-message');
    const values = getFormValues(form);

    setFormMessage(message, '保存中です...', 'muted');

    try {
        const data = await requestJson('/api/settings', {
            method: 'PUT',
            body: JSON.stringify({
                ...values,
                notifications: values.notifications === 'true'
            })
        });
        applyAppData(data);
        renderCurrentView();
        setFormMessage(document.querySelector('#settings-profile-message'), '設定を保存しました。');
        scheduleAutoLogout();
    } catch (error) {
        setFormMessage(message, error.message, 'error');
    }
}

async function handleInterviewSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const message = form.querySelector('#interview-reservation-message');
    const values = getFormValues(form);
    values.time = formatInterviewTime(values.timeRange);
    delete values.timeRange;

    setFormMessage(message, '送信中です...', 'muted');

    try {
        const data = await requestJson('/api/interview-reservations', {
            method: 'POST',
            body: JSON.stringify(values)
        });
        applyAppData(data);
        renderCurrentView();
        setFormMessage(document.querySelector('#interview-reservation-message'), '面談予約を送信しました。');
        scheduleAutoLogout();
    } catch (error) {
        setFormMessage(message, error.message, 'error');
    }
}

async function handleAssignmentSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const message = form.querySelector('.form-message');
    const file = form.elements.photo.files[0];

    if (!file) {
        setFormMessage(message, '課題写真を選択してください。', 'error');
        return;
    }

    setFormMessage(message, '提出中です...', 'muted');

    try {
        const photoDataUrl = await readFileAsDataUrl(file);
        const data = await requestJson(`/api/assignments/${encodeURIComponent(form.dataset.assignmentId)}/submission`, {
            method: 'POST',
            body: JSON.stringify({ photoDataUrl })
        });
        applyAppData(data);
        renderCurrentView();
        setFormMessage(document.querySelector(`#assignment-message-${form.dataset.assignmentId}`), '課題を提出しました。');
        scheduleAutoLogout();
    } catch (error) {
        setFormMessage(message, error.message, 'error');
    }
}

async function handleScoreSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const message = form.querySelector('#score-report-message');
    const reports = Array.from(form.querySelectorAll('.score-entry-row:not(.score-entry-header)')).map((row) => {
        const custom = row.dataset.custom === 'true';
        const subjectInput = custom ? row.querySelector('input[name="subject"]') : null;
        const score = row.querySelector('input[name="score"]').value;
        const averageScore = row.querySelector('input[name="averageScore"]').value;
        const gradeRank = row.querySelector('input[name="gradeRank"]').value;
        const subject = custom ? subjectInput.value : row.dataset.subject;
        const hasScoreValue = score || averageScore || gradeRank;

        return {
            subject,
            score,
            averageScore,
            gradeRank,
            shouldSubmit: custom ? Boolean(subject || hasScoreValue) : Boolean(hasScoreValue)
        };
    }).filter((report) => report.shouldSubmit).map(({ shouldSubmit, ...report }) => report);
    const values = getFormValues(form);

    setFormMessage(message, '保存中です...', 'muted');

    try {
        const data = await requestJson('/api/score-reports', {
            method: 'POST',
            body: JSON.stringify({
                testType: values.testType,
                reports
            })
        });
        applyAppData(data);
        renderCurrentView();
        setFormMessage(document.querySelector('#score-report-message'), '成績を保存しました。');
        scheduleAutoLogout();
    } catch (error) {
        setFormMessage(message, error.message, 'error');
    }
}

async function handleTeacherAssignmentSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const message = form.querySelector('#teacher-assignment-message');
    const values = getFormValues(form);

    setFormMessage(message, '送信中です...', 'muted');

    try {
        const data = await requestJson('/api/teacher/assignments', {
            method: 'POST',
            body: JSON.stringify(values)
        });
        teacherData = data.teacherData;
        renderCurrentView();
        setFormMessage(document.querySelector('#teacher-assignment-message'), `${data.sentCount}名に課題を送信しました。`);
        scheduleAutoLogout();
    } catch (error) {
        setFormMessage(message, error.message, 'error');
    }
}

async function handleTeacherEvaluationSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const message = form.querySelector('.form-message');
    const values = getFormValues(form);

    setFormMessage(message, '返却中です...', 'muted');

    try {
        const data = await requestJson('/api/teacher/assignments/evaluation', {
            method: 'PUT',
            body: JSON.stringify({
                ...values,
                studentId: form.dataset.studentId,
                assignmentId: form.dataset.assignmentId
            })
        });
        teacherData = data.teacherData;
        renderCurrentView();
        scheduleAutoLogout();
    } catch (error) {
        setFormMessage(message, error.message, 'error');
    }
}

async function handleTeacherScheduleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const message = form.querySelector('#teacher-schedule-message');
    const values = getFormValues(form);

    setFormMessage(message, '送信中です...', 'muted');

    try {
        const data = await requestJson('/api/teacher/schedules', {
            method: 'POST',
            body: JSON.stringify(values)
        });
        teacherData = data.teacherData;
        renderCurrentView();
        setFormMessage(document.querySelector('#teacher-schedule-message'), `${data.sentCount}名に予定を送信しました。`);
        scheduleAutoLogout();
    } catch (error) {
        setFormMessage(message, error.message, 'error');
    }
}

async function handlePasswordSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const message = form.querySelector('#settings-password-message');
    const values = getFormValues(form);

    setFormMessage(message, '変更中です...', 'muted');

    try {
        await requestJson('/api/password', {
            method: 'PUT',
            body: JSON.stringify(values)
        });
        form.reset();
        setFormMessage(message, 'パスワードを変更しました。');
        scheduleAutoLogout();
    } catch (error) {
        setFormMessage(message, error.message, 'error');
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    elements.loginError.textContent = '';

    try {
        await login(elements.studentId.value, elements.studentPassword.value);
    } catch (error) {
        elements.loginError.textContent = error.message;
        elements.studentPassword.value = '';
        elements.studentPassword.focus();
    }
}

function setupSidebarToggle() {
    elements.sidebarToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('is-open');
        refreshSessionActivity();
    });
}

function setupAuthEvents() {
    elements.loginForm.addEventListener('submit', handleLoginSubmit);
    elements.logoutButton.addEventListener('click', () => logout());

    ['click', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
        window.addEventListener(eventName, () => {
            refreshSessionActivity();
        }, { passive: true });
    });

    window.addEventListener('hashchange', () => {
        currentView = getViewFromHash();
        renderCurrentView();
        refreshSessionActivity();
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            restoreSession('ログインの有効期限が切れました。再度ログインしてください。');
        }
    });

    window.addEventListener('focus', () => {
        restoreSession('ログインの有効期限が切れました。再度ログインしてください。');
    });
}

async function restoreSession(expiredMessage = '') {
    try {
        const data = await requestJson('/api/me');
        applyAppData(data);
        showDashboard();
    } catch {
        showLogin(expiredMessage);
    }
}

function initDashboard() {
    setupSidebarToggle();
    setupAuthEvents();
    restoreSession();
}

initDashboard();
