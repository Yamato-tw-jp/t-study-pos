const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.PORT || 4173);
const SESSION_COOKIE = 'tstudy_sid';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const JSON_BODY_LIMIT_BYTES = 5 * 1024 * 1024;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = 'sha512';

const publicDir = __dirname;
const sessions = new Map();

const appConfig = {
    appTitle: 'T-Study POS',
    courseOptions: [
        '面談無しコース',
        '週一面談コース',
        '週二面談コース'
    ],
    testTypeOptions: [
        '定期テスト',
        '実力テスト',
        '模試',
        'その他'
    ],
    subjectOptionsByGrade: {
        middle: ['国語', '数学', '社会', '理科', '英語'],
        high1: ['現代文', '古文', '漢文', '数1', '数A', '物理基礎', '化学基礎', '生物基礎', '英語コミュニケーション', '英語論理表現', '歴史総合', '地理総合'],
        high2: ['現代文', '古文', '漢文', '数2', '数B', '物理', '化学', '生物', '英語コミュニケーション', '英語論理表現', '日本史', '世界史', '地理', '倫理'],
        high3: ['現代文', '古文', '漢文', '数3', '数C', '物理', '化学', '生物', '英語コミュニケーション', '英語論理表現', '日本史', '世界史', '地理', '倫理']
    },
    gradeOptions: [
        '中学1年',
        '中学2年',
        '中学3年',
        '高校1年',
        '高校2年',
        '高校3年',
        '既卒'
    ],
    menuItems: [
        { id: 'home', label: 'ホーム', href: '#home', active: true },
        { id: 'interview', label: '面談予約', href: '#interview' },
        { id: 'assignments', label: '課題提出', href: '#assignments' },
        { id: 'scores', label: 'テスト成績', href: '#scores' },
        { id: 'schedule', label: '学習スケジュール', href: '#schedule' },
        { id: 'settings', label: '設定', href: '#settings' }
    ],
    teacherMenuItems: [
        { id: 'teacher-home', label: '管理ホーム', href: '#teacher-home', active: true },
        { id: 'teacher-students', label: '生徒管理', href: '#teacher-students' },
        { id: 'teacher-assignments', label: '課題管理', href: '#teacher-assignments' },
        { id: 'teacher-schedule', label: '予定送信', href: '#teacher-schedule' }
    ]
};

const teachers = [
    {
        id: 'teacher001',
        passwordSalt: '1c2f86fd0ed2a5a3b087cdbbbd623c40',
        passwordHash: 'cde17b7abaeb1a3185ac6319d4716f20935a9a453f2f3f3f84e2054886af6032a99df565024d7272a54f8df132c22d920fcbcd96246c6099263606287a997f28',
        profile: {
            name: '山下先生',
            subject: '英語',
            roleLabel: '教師'
        }
    }
];

const students = [
    {
        id: 'kanda001',
        passwordSalt: 'a8b812f8e6e4a851e1a7e3bf2bd0fe28',
        passwordHash: 'e0ea47f6d8d061b2a2ff5fe94e53cda0a9c26e1c6514e1b516b347e889861c9364a43020cce8db5e48a0c197158666b3d312886235a57b58b739325e149c295f',
        profile: {
            name: '神田',
            goal: '志望校合格！',
            subtitle: '今日の予定と進度を確認しましょう',
            progressItems: [
                { subject: '英語：長文読解 第3講', percent: 80 },
                { subject: '数学：微分積分 基礎', percent: 45 }
            ],
            assignments: [
                {
                    id: 'assign-kanda-1',
                    title: '英語 長文読解プリント',
                    subject: '英語',
                    dueDate: '金曜 21:00',
                    instructions: '指定範囲を解き、丸付け前の答案を写真で提出してください。',
                    status: 'submitted',
                    submittedAt: '昨日 22:10',
                    photoDataUrl: '',
                    evaluation: '',
                    feedback: ''
                },
                {
                    id: 'assign-kanda-2',
                    title: '数学 微分積分 基礎演習',
                    subject: '数学',
                    dueDate: '日曜 20:00',
                    instructions: 'ノートに途中式を残して解き、見開きで写真を撮って提出してください。',
                    status: 'assigned',
                    submittedAt: '',
                    photoDataUrl: '',
                    evaluation: '',
                    feedback: ''
                }
            ],
            schedules: [
                { date: '今日 18:00', event: '数学 小テスト' },
                { date: '明日 19:30', event: 'チューター面談' }
            ],
            newsItems: [
                { title: '【重要】夏期講習の申し込み開始について', href: '#summer-course' },
                { title: '自習室の開放時間が変更になりました', href: '#study-room' },
                { title: '第2回 模擬試験の成績表を返却しています', href: '#mock-test' }
            ],
            lessons: [
                { subject: '英語', title: '長文読解 第3講', teacher: '山下先生', duration: '45分', status: '受講中', progress: 80 },
                { subject: '数学', title: '微分積分 基礎', teacher: '高橋先生', duration: '50分', status: '受講中', progress: 45 },
                { subject: '化学', title: '酸化還元反応 演習', teacher: '中村先生', duration: '40分', status: '未受講', progress: 0 }
            ],
            scoreReports: [
                { testType: '模試', subject: '英語コミュニケーション', score: 78, averageScore: 63, gradeRank: 42 },
                { testType: '定期テスト', subject: '数3', score: 64, averageScore: 58, gradeRank: 81 },
                { testType: '実力テスト', subject: '現代文', score: 71, averageScore: 66, gradeRank: 55 }
            ],
            scheduleDetails: [
                { date: '今日', time: '18:00', title: '数学 小テスト', place: '2番教室' },
                { date: '明日', time: '19:30', title: 'チューター面談', place: '面談ブースA' },
                { date: '土曜', time: '15:00', title: '英語 長文演習', place: 'オンライン' }
            ],
            settings: {
                displayName: '神田さん',
                registeredEmail: 'kanda@example.com',
                parentEmail: 'parent-kanda@example.com',
                grade: '高校3年',
                startedAsMiddleSchool: false,
                lastGradePromotionYear: 2026,
                course: '週一面談コース',
                notifications: true
            }
        }
    },
    {
        id: 'sato002',
        passwordSalt: '6bc4c5aa0d5de51e0490de3a70cd03f6',
        passwordHash: '788dec090fa7cb5bc2bb460e8749e689d8387ba51d763a6745ba6f515cc8d200089e5bcf91fd2e116cbacbdc95cb157194e22c26b294274a3db039dcda5fa35b',
        profile: {
            name: '佐藤',
            goal: '英語偏差値65',
            subtitle: '苦手単元を優先して進めましょう',
            progressItems: [
                { subject: '英語：英文法 仮定法', percent: 60 },
                { subject: '国語：現代文 読解演習', percent: 30 }
            ],
            assignments: [
                {
                    id: 'assign-sato-1',
                    title: '英語 仮定法ワーク',
                    subject: '英語',
                    dueDate: '木曜 21:00',
                    instructions: 'ワークP32からP35を解き、解答欄全体が見える写真を提出してください。',
                    status: 'returned',
                    submittedAt: '月曜 20:42',
                    photoDataUrl: '',
                    evaluation: 'B',
                    feedback: '基本問題はよくできています。仮定法過去完了の訳をもう一度確認しましょう。'
                },
                {
                    id: 'assign-sato-2',
                    title: '現代文 読解メモ',
                    subject: '国語',
                    dueDate: '土曜 18:00',
                    instructions: '本文の根拠に線を引いた状態で、ノートを写真提出してください。',
                    status: 'assigned',
                    submittedAt: '',
                    photoDataUrl: '',
                    evaluation: '',
                    feedback: ''
                }
            ],
            schedules: [
                { date: '今日 20:00', event: '英語 確認テスト' },
                { date: '金曜 18:30', event: '進路面談' }
            ],
            newsItems: [
                { title: '英単語テストの範囲を更新しました', href: '#english-test' },
                { title: '面談予約フォームを公開しました', href: '#interview-form' }
            ],
            lessons: [
                { subject: '英語', title: '英文法 仮定法', teacher: '山下先生', duration: '42分', status: '受講中', progress: 60 },
                { subject: '国語', title: '現代文 読解演習', teacher: '小林先生', duration: '48分', status: '受講中', progress: 30 },
                { subject: '英語', title: '長文読解 実戦演習', teacher: '山下先生', duration: '55分', status: '未受講', progress: 0 }
            ],
            scoreReports: [
                { testType: '模試', subject: '英語コミュニケーション', score: 82, averageScore: 61, gradeRank: 28 },
                { testType: '定期テスト', subject: '現代文', score: 59, averageScore: 62, gradeRank: 96 },
                { testType: '実力テスト', subject: '英語論理表現', score: 92, averageScore: 70, gradeRank: 12 }
            ],
            scheduleDetails: [
                { date: '今日', time: '20:00', title: '英語 確認テスト', place: '1番教室' },
                { date: '金曜', time: '18:30', title: '進路面談', place: '面談ブースB' },
                { date: '日曜', time: '10:00', title: '自習予約', place: '自習室' }
            ],
            settings: {
                displayName: '佐藤さん',
                registeredEmail: 'sato@example.com',
                parentEmail: 'parent-sato@example.com',
                grade: '高校2年',
                startedAsMiddleSchool: false,
                lastGradePromotionYear: 2026,
                course: '週二面談コース',
                notifications: true
            }
        }
    }
];

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
};

function sendJson(response, statusCode, data, extraHeaders = {}) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...extraHeaders
    });
    response.end(JSON.stringify(data));
}

function sendError(response, statusCode, message) {
    sendJson(response, statusCode, { error: message });
}

function parseCookies(cookieHeader = '') {
    return cookieHeader.split(';').reduce((cookies, cookie) => {
        const [name, ...valueParts] = cookie.trim().split('=');

        if (name) {
            cookies[name] = decodeURIComponent(valueParts.join('='));
        }

        return cookies;
    }, {});
}

function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';

        request.on('data', (chunk) => {
            body += chunk;

            if (body.length > JSON_BODY_LIMIT_BYTES) {
                reject(new Error('Request body is too large.'));
                request.destroy();
            }
        });

        request.on('end', () => {
            if (!body) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error('Invalid JSON.'));
            }
        });

        request.on('error', reject);
    });
}

function hashPassword(password, salt) {
    return crypto
        .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST)
        .toString('hex');
}

function createPasswordRecord(password) {
    const salt = crypto.randomBytes(16).toString('hex');

    return {
        passwordSalt: salt,
        passwordHash: hashPassword(password, salt)
    };
}

function timingSafeEqualHex(left, right) {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');

    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function findStudentByCredentials(studentId, password) {
    const student = students.find((entry) => entry.id === String(studentId || '').trim());

    if (!student || typeof password !== 'string') {
        return null;
    }

    const attemptedHash = hashPassword(password, student.passwordSalt);
    return timingSafeEqualHex(attemptedHash, student.passwordHash) ? student : null;
}

function findTeacherByCredentials(teacherId, password) {
    const teacher = teachers.find((entry) => entry.id === String(teacherId || '').trim());

    if (!teacher || typeof password !== 'string') {
        return null;
    }

    const attemptedHash = hashPassword(password, teacher.passwordSalt);
    return timingSafeEqualHex(attemptedHash, teacher.passwordHash) ? teacher : null;
}

function findAccountByCredentials(accountId, password) {
    const student = findStudentByCredentials(accountId, password);

    if (student) {
        return { account: student, role: 'student' };
    }

    const teacher = findTeacherByCredentials(accountId, password);

    if (teacher) {
        return { account: teacher, role: 'teacher' };
    }

    return null;
}

function createSession(accountId, role) {
    const sessionId = crypto.randomBytes(32).toString('hex');

    sessions.set(sessionId, {
        accountId,
        role,
        lastActiveAt: Date.now()
    });

    return sessionId;
}

function getSession(request) {
    const cookies = parseCookies(request.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];

    if (!sessionId) {
        return null;
    }

    const session = sessions.get(sessionId);

    if (!session) {
        return null;
    }

    if (Date.now() - session.lastActiveAt > SESSION_TIMEOUT_MS) {
        sessions.delete(sessionId);
        return null;
    }

    session.lastActiveAt = Date.now();
    sessions.set(sessionId, session);

    return { sessionId, ...session };
}

function getAcademicYear(date = new Date()) {
    const month = date.getMonth();
    const day = date.getDate();

    return month > 3 || (month === 3 && day >= 1)
        ? date.getFullYear()
        : date.getFullYear() - 1;
}

function getNextGrade(grade) {
    const nextGrades = {
        '中学1年': '中学2年',
        '中学2年': '中学3年',
        '中学3年': '高校1年',
        '高校1年': '高校2年',
        '高校2年': '高校3年',
        '高校3年': '既卒',
        '既卒': '既卒'
    };

    return nextGrades[grade] || grade;
}

function applyAutomaticGradePromotion(student, date = new Date()) {
    const settings = student.profile.settings;

    const currentAcademicYear = getAcademicYear(date);
    let lastGradePromotionYear = Number(settings.lastGradePromotionYear || currentAcademicYear);

    while (lastGradePromotionYear < currentAcademicYear) {
        settings.grade = getNextGrade(settings.grade);
        lastGradePromotionYear += 1;
    }

    settings.lastGradePromotionYear = lastGradePromotionYear;
}

function getPublicSettings(settings) {
    const {
        startedAsMiddleSchool,
        lastGradePromotionYear,
        ...publicSettings
    } = settings;

    return publicSettings;
}

function getAppForRole(role) {
    return {
        appTitle: appConfig.appTitle,
        courseOptions: appConfig.courseOptions,
        gradeOptions: appConfig.gradeOptions,
        testTypeOptions: appConfig.testTypeOptions,
        subjectOptionsByGrade: appConfig.subjectOptionsByGrade,
        menuItems: role === 'teacher' ? appConfig.teacherMenuItems : appConfig.menuItems
    };
}

function getStudentProfile(studentId) {
    const student = students.find((entry) => entry.id === studentId);

    if (!student) {
        return null;
    }

    applyAutomaticGradePromotion(student);

    return {
        id: student.id,
        ...student.profile,
        progressItems: getAssignmentProgressItems(student),
        settings: getPublicSettings(student.profile.settings)
    };
}

function getTeacherProfile(teacherId) {
    const teacher = teachers.find((entry) => entry.id === teacherId);

    if (!teacher) {
        return null;
    }

    return {
        id: teacher.id,
        ...teacher.profile
    };
}

function getAssignmentPercent(assignment) {
    const statusPercents = {
        assigned: 0,
        submitted: 60,
        returned: 100
    };

    return statusPercents[assignment.status] ?? 0;
}

function getAssignmentStatusLabel(status) {
    const labels = {
        assigned: '未提出',
        submitted: '提出済み',
        returned: '返却済み'
    };

    return labels[status] || '未提出';
}

function getAssignmentProgressItems(student) {
    const assignments = student.profile.assignments || [];

    if (!assignments.length) {
        return student.profile.progressItems || [];
    }

    return assignments.map((assignment) => ({
        subject: `${assignment.subject}：${assignment.title}`,
        percent: getAssignmentPercent(assignment)
    }));
}

function getAverageAssignmentProgress(student) {
    const assignments = student.profile.assignments || [];

    if (!assignments.length) {
        return 0;
    }

    const total = assignments.reduce((sum, assignment) => sum + getAssignmentPercent(assignment), 0);
    return Math.round(total / assignments.length);
}

function getAssignmentCounts(student) {
    const assignments = student.profile.assignments || [];

    return {
        total: assignments.length,
        assigned: assignments.filter((assignment) => assignment.status === 'assigned').length,
        submitted: assignments.filter((assignment) => assignment.status === 'submitted').length,
        returned: assignments.filter((assignment) => assignment.status === 'returned').length
    };
}

function getStudentManagementRows() {
    return students.map((student) => {
        const profile = getStudentProfile(student.id);
        const latestSchedule = profile.scheduleDetails[0];

        return {
            id: profile.id,
            name: profile.name,
            displayName: profile.settings.displayName,
            grade: profile.settings.grade,
            course: profile.settings.course,
            averageProgress: getAverageAssignmentProgress(student),
            activeLessons: getAssignmentCounts(student).assigned + getAssignmentCounts(student).submitted,
            assignmentCounts: getAssignmentCounts(student),
            nextSchedule: latestSchedule
                ? `${latestSchedule.date} ${latestSchedule.time} ${latestSchedule.title}`
                : '予定なし'
        };
    });
}

function getTeacherOverview() {
    const rows = getStudentManagementRows();

    return {
        summary: {
            studentCount: rows.length,
            averageProgress: rows.length
                ? Math.round(rows.reduce((sum, row) => sum + row.averageProgress, 0) / rows.length)
                : 0,
            activeLessons: rows.reduce((sum, row) => sum + row.activeLessons, 0)
        },
        students: rows,
        assignments: students.flatMap((student) => {
            const profile = getStudentProfile(student.id);
            return (profile.assignments || []).map((assignment) => ({
                ...assignment,
                studentId: profile.id,
                studentName: profile.settings.displayName,
                statusLabel: getAssignmentStatusLabel(assignment.status)
            }));
        })
    };
}

function getTeacherPayload(teacherId) {
    return {
        teacher: getTeacherProfile(teacherId),
        teacherData: getTeacherOverview()
    };
}

function normalizeText(value, maxLength = 100) {
    return String(value || '').trim().slice(0, maxLength);
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function updateStudentSettings(student, payload) {
    const currentSettings = student.profile.settings;
    const nextSettings = {
        displayName: normalizeText(payload.displayName, 40),
        registeredEmail: normalizeText(payload.registeredEmail, 120),
        parentEmail: normalizeText(payload.parentEmail, 120),
        grade: normalizeText(payload.grade, 20),
        startedAsMiddleSchool: Boolean(currentSettings.startedAsMiddleSchool),
        lastGradePromotionYear: Number(currentSettings.lastGradePromotionYear || getAcademicYear()),
        course: normalizeText(payload.course, 80),
        notifications: Boolean(payload.notifications)
    };

    if (!nextSettings.displayName) {
        return '表示名を入力してください。';
    }

    if (![nextSettings.registeredEmail, nextSettings.parentEmail].every(isValidEmail)) {
        return 'メールアドレスを正しく入力してください。';
    }

    if (!appConfig.gradeOptions.includes(nextSettings.grade)) {
        return '学年を選択してください。';
    }

    if (!appConfig.courseOptions.includes(nextSettings.course)) {
        return '受講コースを選択してください。';
    }

    student.profile.settings = nextSettings;
    student.profile.goal = nextSettings.course;
    student.profile.subtitle = `${nextSettings.displayName}の学習状況を確認しましょう`;

    return null;
}

function normalizeNumber(value) {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function getSubjectGroupForGrade(grade) {
    if (String(grade || '').startsWith('中学')) {
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

function getSubjectsForGrade(grade) {
    return appConfig.subjectOptionsByGrade[getSubjectGroupForGrade(grade)];
}

function addScoreReports(student, payload) {
    const testType = normalizeText(payload.testType, 40);
    const allowedSubjects = getSubjectsForGrade(student.profile.settings.grade);
    const reports = Array.isArray(payload.reports) ? payload.reports : [];
    const normalizedReports = reports.map((report) => ({
        testType,
        subject: normalizeText(report.subject, 40),
        score: normalizeNumber(report.score),
        averageScore: normalizeNumber(report.averageScore),
        gradeRank: normalizeNumber(report.gradeRank)
    })).filter((report) => (
        report.subject || report.score !== null || report.averageScore !== null || report.gradeRank !== null
    ));

    if (!appConfig.testTypeOptions.includes(testType)) {
        return 'テスト分類を選択してください。';
    }

    if (!normalizedReports.length) {
        return '少なくとも1教科分の成績を入力してください。';
    }

    const validReports = [];
    for (const report of normalizedReports) {
        if (!report.subject) {
            return 'その他教科を入力した行は、教科名も入力してください。';
        }

        if (!allowedSubjects.includes(report.subject) && report.subject.length > 40) {
            return '教科名は40文字以内で入力してください。';
        }

        if (report.score === null || report.averageScore === null || report.gradeRank === null) {
            return '点数・平均点・学年順位を入力してください。';
        }

        if (report.score < 0 || report.averageScore < 0 || report.gradeRank < 1) {
            return '点数・平均点・学年順位を正しく入力してください。';
        }

        validReports.push(report);
    }

    student.profile.scoreReports.unshift(...validReports);
    return null;
}

function createAssignmentId() {
    return `assign-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function formatSubmittedAt(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');

    return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function findAssignment(student, assignmentId) {
    return (student.profile.assignments || []).find((assignment) => assignment.id === assignmentId);
}

function getTargetStudents(targetStudentId) {
    return targetStudentId === 'all'
        ? students
        : students.filter((student) => student.id === targetStudentId);
}

function createTeacherAssignment(payload) {
    const targetStudentId = normalizeText(payload.targetStudentId, 40);
    const assignment = {
        id: createAssignmentId(),
        title: normalizeText(payload.title, 80),
        subject: normalizeText(payload.subject, 40),
        dueDate: normalizeText(payload.dueDate, 40),
        instructions: normalizeText(payload.instructions, 300),
        status: 'assigned',
        submittedAt: '',
        photoDataUrl: '',
        evaluation: '',
        feedback: ''
    };

    if (!assignment.title || !assignment.subject || !assignment.dueDate || !assignment.instructions) {
        return { error: '課題名・教科・期限・指示を入力してください。' };
    }

    const targetStudents = getTargetStudents(targetStudentId);

    if (!targetStudents.length) {
        return { error: '送信先の生徒が見つかりません。' };
    }

    targetStudents.forEach((student) => {
        student.profile.assignments.unshift({
            ...assignment,
            id: createAssignmentId()
        });
    });

    return { sentCount: targetStudents.length };
}

function submitAssignment(student, assignmentId, payload) {
    const assignment = findAssignment(student, assignmentId);
    const photoDataUrl = normalizeText(payload.photoDataUrl, JSON_BODY_LIMIT_BYTES);

    if (!assignment) {
        return '課題が見つかりません。';
    }

    if (!photoDataUrl.startsWith('data:image/')) {
        return '課題写真を選択してください。';
    }

    assignment.status = 'submitted';
    assignment.submittedAt = formatSubmittedAt();
    assignment.photoDataUrl = photoDataUrl;
    assignment.evaluation = '';
    assignment.feedback = '';

    return null;
}

function evaluateAssignment(payload) {
    const studentId = normalizeText(payload.studentId, 40);
    const assignmentId = normalizeText(payload.assignmentId, 80);
    const evaluation = normalizeText(payload.evaluation, 20);
    const feedback = normalizeText(payload.feedback, 300);
    const student = students.find((entry) => entry.id === studentId);

    if (!student) {
        return '生徒が見つかりません。';
    }

    const assignment = findAssignment(student, assignmentId);

    if (!assignment) {
        return '課題が見つかりません。';
    }

    if (!evaluation || !feedback) {
        return '評価とコメントを入力してください。';
    }

    assignment.status = 'returned';
    assignment.evaluation = evaluation;
    assignment.feedback = feedback;

    return null;
}

function makeSessionCookie(sessionId) {
    return [
        `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
        'HttpOnly',
        'SameSite=Lax',
        'Path=/',
        `Max-Age=${Math.floor(SESSION_TIMEOUT_MS / 1000)}`
    ].join('; ');
}

function makeExpiredSessionCookie() {
    return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

async function handleApi(request, response, pathname) {
    if (request.method === 'POST' && pathname === '/api/login') {
        try {
            const { studentId, password } = await readJsonBody(request);
            const login = findAccountByCredentials(studentId, password);

            if (!login) {
                sendError(response, 401, 'IDまたはパスワードが正しくありません。');
                return;
            }

            const sessionId = createSession(login.account.id, login.role);
            const payload = login.role === 'teacher'
                ? {
                    app: getAppForRole('teacher'),
                    role: 'teacher',
                    ...getTeacherPayload(login.account.id)
                }
                : {
                    app: getAppForRole('student'),
                    role: 'student',
                    student: getStudentProfile(login.account.id)
                };

            sendJson(response, 200, payload, {
                'Set-Cookie': makeSessionCookie(sessionId)
            });
        } catch {
            sendError(response, 400, 'ログイン情報を正しく送信してください。');
        }
        return;
    }

    if (request.method === 'GET' && pathname === '/api/me') {
        const session = getSession(request);

        if (!session) {
            sendError(response, 401, 'ログインが必要です。');
            return;
        }

        const payload = session.role === 'teacher'
            ? {
                app: getAppForRole('teacher'),
                role: 'teacher',
                ...getTeacherPayload(session.accountId)
            }
            : {
                app: getAppForRole('student'),
                role: 'student',
                student: getStudentProfile(session.accountId)
            };

        sendJson(response, 200, payload, {
            'Set-Cookie': makeSessionCookie(session.sessionId)
        });
        return;
    }

    if (request.method === 'POST' && pathname === '/api/activity') {
        const session = getSession(request);

        if (!session) {
            sendError(response, 401, 'ログインが必要です。');
            return;
        }

        sendJson(response, 200, { ok: true }, {
            'Set-Cookie': makeSessionCookie(session.sessionId)
        });
        return;
    }

    if (request.method === 'PUT' && pathname === '/api/settings') {
        const session = getSession(request);

        if (!session) {
            sendError(response, 401, 'ログインが必要です。');
            return;
        }

        if (session.role !== 'student') {
            sendError(response, 403, '生徒アカウントでログインしてください。');
            return;
        }

        const student = students.find((entry) => entry.id === session.accountId);

        if (!student) {
            sendError(response, 404, '生徒情報が見つかりません。');
            return;
        }

        try {
            const payload = await readJsonBody(request);
            const validationError = updateStudentSettings(student, payload);

            if (validationError) {
                sendError(response, 400, validationError);
                return;
            }

            sendJson(response, 200, {
                app: getAppForRole('student'),
                role: 'student',
                student: getStudentProfile(student.id)
            }, {
                'Set-Cookie': makeSessionCookie(session.sessionId)
            });
        } catch {
            sendError(response, 400, '設定情報を正しく送信してください。');
        }
        return;
    }

    if (request.method === 'PUT' && pathname === '/api/password') {
        const session = getSession(request);

        if (!session) {
            sendError(response, 401, 'ログインが必要です。');
            return;
        }

        if (session.role !== 'student') {
            sendError(response, 403, '生徒アカウントでログインしてください。');
            return;
        }

        const student = students.find((entry) => entry.id === session.accountId);

        if (!student) {
            sendError(response, 404, '生徒情報が見つかりません。');
            return;
        }

        try {
            const { currentPassword, newPassword } = await readJsonBody(request);
            const verifiedStudent = findStudentByCredentials(student.id, currentPassword);

            if (!verifiedStudent) {
                sendError(response, 401, '現在のパスワードが正しくありません。');
                return;
            }

            if (typeof newPassword !== 'string' || newPassword.length < 8) {
                sendError(response, 400, '新しいパスワードは8文字以上で入力してください。');
                return;
            }

            Object.assign(student, createPasswordRecord(newPassword));
            sendJson(response, 200, { ok: true }, {
                'Set-Cookie': makeSessionCookie(session.sessionId)
            });
        } catch {
            sendError(response, 400, 'パスワード情報を正しく送信してください。');
        }
        return;
    }

    if (request.method === 'POST' && pathname === '/api/interview-reservations') {
        const session = getSession(request);

        if (!session) {
            sendError(response, 401, 'ログインが必要です。');
            return;
        }

        if (session.role !== 'student') {
            sendError(response, 403, '生徒アカウントでログインしてください。');
            return;
        }

        const student = students.find((entry) => entry.id === session.accountId);

        if (!student) {
            sendError(response, 404, '生徒情報が見つかりません。');
            return;
        }

        try {
            const payload = await readJsonBody(request);
            const reservation = {
                date: normalizeText(payload.date, 20),
                time: normalizeText(payload.time, 20),
                topic: normalizeText(payload.topic, 80),
                note: normalizeText(payload.note, 200)
            };

            if (!reservation.date || !reservation.time || !reservation.topic) {
                sendError(response, 400, '希望日・希望時間・面談内容を入力してください。');
                return;
            }

            const title = `面談予約：${reservation.topic}`;
            student.profile.scheduleDetails.unshift({
                date: reservation.date,
                time: reservation.time,
                title,
                place: '面談ブース'
            });
            student.profile.schedules.unshift({
                date: `${reservation.date} ${reservation.time}`,
                event: title
            });

            sendJson(response, 200, {
                app: getAppForRole('student'),
                role: 'student',
                student: getStudentProfile(student.id)
            }, {
                'Set-Cookie': makeSessionCookie(session.sessionId)
            });
        } catch {
            sendError(response, 400, '面談予約を正しく送信してください。');
        }
        return;
    }

    if (request.method === 'POST' && pathname === '/api/score-reports') {
        const session = getSession(request);

        if (!session) {
            sendError(response, 401, 'ログインが必要です。');
            return;
        }

        if (session.role !== 'student') {
            sendError(response, 403, '生徒アカウントでログインしてください。');
            return;
        }

        const student = students.find((entry) => entry.id === session.accountId);

        if (!student) {
            sendError(response, 404, '生徒情報が見つかりません。');
            return;
        }

        try {
            const payload = await readJsonBody(request);
            const validationError = addScoreReports(student, payload);

            if (validationError) {
                sendError(response, 400, validationError);
                return;
            }

            sendJson(response, 200, {
                app: getAppForRole('student'),
                role: 'student',
                student: getStudentProfile(student.id)
            }, {
                'Set-Cookie': makeSessionCookie(session.sessionId)
            });
        } catch {
            sendError(response, 400, '成績情報を正しく送信してください。');
        }
        return;
    }

    const assignmentSubmissionMatch = pathname.match(/^\/api\/assignments\/([^/]+)\/submission$/);
    if (request.method === 'POST' && assignmentSubmissionMatch) {
        const session = getSession(request);

        if (!session) {
            sendError(response, 401, 'ログインが必要です。');
            return;
        }

        if (session.role !== 'student') {
            sendError(response, 403, '生徒アカウントでログインしてください。');
            return;
        }

        const student = students.find((entry) => entry.id === session.accountId);

        if (!student) {
            sendError(response, 404, '生徒情報が見つかりません。');
            return;
        }

        try {
            const payload = await readJsonBody(request);
            const validationError = submitAssignment(student, decodeURIComponent(assignmentSubmissionMatch[1]), payload);

            if (validationError) {
                sendError(response, 400, validationError);
                return;
            }

            sendJson(response, 200, {
                app: getAppForRole('student'),
                role: 'student',
                student: getStudentProfile(student.id)
            }, {
                'Set-Cookie': makeSessionCookie(session.sessionId)
            });
        } catch {
            sendError(response, 400, '課題提出を正しく送信してください。');
        }
        return;
    }

    if (request.method === 'GET' && pathname === '/api/teacher/overview') {
        const session = getSession(request);

        if (!session) {
            sendError(response, 401, 'ログインが必要です。');
            return;
        }

        if (session.role !== 'teacher') {
            sendError(response, 403, '教師アカウントでログインしてください。');
            return;
        }

        sendJson(response, 200, {
            app: getAppForRole('teacher'),
            role: 'teacher',
            ...getTeacherPayload(session.accountId)
        }, {
            'Set-Cookie': makeSessionCookie(session.sessionId)
        });
        return;
    }

    if (request.method === 'POST' && pathname === '/api/teacher/assignments') {
        const session = getSession(request);

        if (!session) {
            sendError(response, 401, 'ログインが必要です。');
            return;
        }

        if (session.role !== 'teacher') {
            sendError(response, 403, '教師アカウントでログインしてください。');
            return;
        }

        try {
            const payload = await readJsonBody(request);
            const result = createTeacherAssignment(payload);

            if (result.error) {
                sendError(response, 400, result.error);
                return;
            }

            sendJson(response, 200, {
                ok: true,
                sentCount: result.sentCount,
                teacherData: getTeacherOverview()
            }, {
                'Set-Cookie': makeSessionCookie(session.sessionId)
            });
        } catch {
            sendError(response, 400, '課題情報を正しく送信してください。');
        }
        return;
    }

    if (request.method === 'PUT' && pathname === '/api/teacher/assignments/evaluation') {
        const session = getSession(request);

        if (!session) {
            sendError(response, 401, 'ログインが必要です。');
            return;
        }

        if (session.role !== 'teacher') {
            sendError(response, 403, '教師アカウントでログインしてください。');
            return;
        }

        try {
            const payload = await readJsonBody(request);
            const validationError = evaluateAssignment(payload);

            if (validationError) {
                sendError(response, 400, validationError);
                return;
            }

            sendJson(response, 200, {
                ok: true,
                teacherData: getTeacherOverview()
            }, {
                'Set-Cookie': makeSessionCookie(session.sessionId)
            });
        } catch {
            sendError(response, 400, '評価情報を正しく送信してください。');
        }
        return;
    }

    if (request.method === 'POST' && pathname === '/api/teacher/schedules') {
        const session = getSession(request);

        if (!session) {
            sendError(response, 401, 'ログインが必要です。');
            return;
        }

        if (session.role !== 'teacher') {
            sendError(response, 403, '教師アカウントでログインしてください。');
            return;
        }

        try {
            const payload = await readJsonBody(request);
            const targetStudentId = normalizeText(payload.targetStudentId, 40);
            const schedule = {
                date: normalizeText(payload.date, 20),
                time: normalizeText(payload.time, 20),
                title: normalizeText(payload.title, 80),
                place: normalizeText(payload.place, 80)
            };

            if (!schedule.date || !schedule.time || !schedule.title || !schedule.place) {
                sendError(response, 400, '予定の日時・内容・場所を入力してください。');
                return;
            }

            const targetStudents = targetStudentId === 'all'
                ? students
                : students.filter((student) => student.id === targetStudentId);

            if (!targetStudents.length) {
                sendError(response, 404, '送信先の生徒が見つかりません。');
                return;
            }

            targetStudents.forEach((student) => {
                student.profile.scheduleDetails.unshift(schedule);
                student.profile.schedules.unshift({
                    date: `${schedule.date} ${schedule.time}`,
                    event: schedule.title
                });
            });

            sendJson(response, 200, {
                ok: true,
                sentCount: targetStudents.length,
                teacherData: getTeacherOverview()
            }, {
                'Set-Cookie': makeSessionCookie(session.sessionId)
            });
        } catch {
            sendError(response, 400, '予定情報を正しく送信してください。');
        }
        return;
    }

    if (request.method === 'POST' && pathname === '/api/logout') {
        const cookies = parseCookies(request.headers.cookie);

        if (cookies[SESSION_COOKIE]) {
            sessions.delete(cookies[SESSION_COOKIE]);
        }

        sendJson(response, 200, { ok: true }, {
            'Set-Cookie': makeExpiredSessionCookie()
        });
        return;
    }

    sendError(response, 404, 'APIが見つかりません。');
}

function sendStaticFile(response, pathname) {
    const normalizedPath = pathname === '/' ? '/index.html' : pathname;
    const requestedPath = path.normalize(decodeURIComponent(normalizedPath)).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(publicDir, requestedPath);

    if (!filePath.startsWith(publicDir)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Not found');
            return;
        }

        response.writeHead(200, {
            'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        response.end(content);
    });
}

const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
        handleApi(request, response, url.pathname);
        return;
    }

    sendStaticFile(response, url.pathname);
});

server.listen(PORT, () => {
    console.log(`T-Study POS server running at http://127.0.0.1:${PORT}`);
});
