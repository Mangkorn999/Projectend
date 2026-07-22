/* ============================================================
   i18n dictionary — TH/EN toggle (student side first)
   Usage: const tt = (key, vars) => t(lang, key, vars);
   ============================================================ */

const DICT = {
  TH: {
    'status.DRAFT': 'ยังไม่กรอก',
    'status.SUBMITTED': 'รอตรวจสอบ',
    'status.CONFIRMED': 'ยืนยันแล้ว',
    'status.REJECTED': 'ถูกตีกลับ',
    'pass.true': 'ผ่าน',
    'pass.false': 'ไม่ผ่าน',
    'pass.none': '—',

    'topbar.title': 'ระบบบันทึกใบประกอบวิชาชีพ',
    'topbar.subtitle': 'คณะพยาบาลศาสตร์ · มหาวิทยาลัยสงขลานครินทร์',
    'topbar.notifTitle': 'การแจ้งเตือน',
    'topbar.notifEmptyTitle': 'ยังไม่มีการแจ้งเตือน',
    'topbar.notifEmptySub': 'เมื่อมีการแจ้งเตือนใหม่ จะแสดงที่นี่',
    'topbar.switchRole': 'สลับมุมมองบทบาท (เดโม)',
    'topbar.logout': 'ออกจากระบบ',

    'role.student': 'นักศึกษา',
    'role.officer': 'เจ้าหน้าที่คณะ',
    'role.executive': 'ผู้บริหารคณะ',
    'role.admin': 'ผู้ดูแลระบบ',

    'sidebar.footerPrefix': 'เข้าใช้งานในบทบาท',

    'nav.student.news': 'ข่าวสาร / ประกาศ',
    'nav.student.form': 'กรอกผลสอบ',
    'nav.student.status': 'สถานะการกรอก',
    'nav.student.history': 'ประวัติการกรอก',

    'news.pageTitle': 'ข่าวสาร / ประกาศ',
    'news.pageSub': 'ติดตามกำหนดการและแนวปฏิบัติจากคณะ',
    'news.openRoundChip': 'รอบเปิดรับขณะนี้',
    'news.roundLine': 'รอบที่ {attempt} ปีการศึกษา {year}',
    'news.openPeriod': 'เปิดรับกรอก {open} – {close}',
    'news.yourStatus': 'สถานะการกรอกของคุณ',
    'news.startBtn': 'เริ่มกรอกผลสอบ',
    'news.pinned': 'ปักหมุด',
    'news.postedBy': 'ผู้ประกาศ: {author}',
    'common.close': 'ปิด',

    'examform.pageTitle': 'กรอกผลสอบใบประกอบวิชาชีพ',
    'examform.pageSub': 'รอบที่ {attempt} ปีการศึกษา {year} · ปิดรับ {close}',
    'examform.crumbHome': 'หน้าหลัก',
    'examform.crumbForm': 'กรอกผลสอบ',
    'examform.steps.0': 'ข้อมูลสภาฯ',
    'examform.steps.1': 'กรอกผลสอบ',
    'examform.steps.2': 'แนบหลักฐาน',
    'examform.steps.3': 'ตรวจทาน',

    'examform.council.title': 'ข้อมูลบัญชีสภาการพยาบาล',
    'examform.council.sub': 'ใช้สำหรับอ้างอิงผลสอบจากระบบสภาฯ (กรอกครั้งเดียว ใช้ได้ทุกรอบ)',
    'examform.council.emailLabel': 'อีเมลสภาการพยาบาล',
    'examform.council.passwordLabel': 'รหัสผ่านสภาการพยาบาล',
    'examform.council.savedNote': 'บันทึกข้อมูลนี้ไว้แล้ว · ไม่ต้องกรอกซ้ำในรอบถัดไป',

    'common.next': 'ถัดไป',
    'common.back': 'ย้อนกลับ',
    'examform.nextUpload': 'ถัดไป: แนบหลักฐาน',
    'examform.nextReview': 'ถัดไป: ตรวจทาน',

    'examresults.title': 'ผลสอบรายวิชา (8 วิชา)',
    'examresults.subToggle': 'ระบุผลแต่ละวิชาว่า "ผ่าน" หรือ "ไม่ผ่าน"',
    'examresults.subCards': 'แตะการ์ดเพื่อเลือกผลสอบของแต่ละวิชา',
    'examresults.allPassBtn': 'ผ่านทั้งหมด',

    'progress.title': 'ความคืบหน้า',
    'progress.filled': 'กรอกแล้ว',
    'progress.legendPass': 'ผ่าน',
    'progress.legendFail': 'ไม่ผ่าน',
    'progress.legendNone': 'ยังไม่ระบุ',
    'progress.saved': 'บันทึกร่างอัตโนมัติแล้ว',
    'progress.saving': 'กำลังบันทึก…',

    'upload.allPassNote': 'คุณสอบผ่านครบทั้ง 8 วิชา — กรุณาแนบทั้งใบรายงานผลสอบ และใบประกอบวิชาชีพ',
    'upload.partialNote': 'มีวิชาที่ยังไม่ผ่าน — แนบเฉพาะใบรายงานผลสอบก็เพียงพอ (แนบใบประกอบวิชาชีพได้เมื่อสอบผ่านครบแล้ว)',
    'upload.examLabel': 'ใบรายงานผลสอบ',
    'upload.examHint': 'ผลสอบรายวิชาทั้ง 8 วิชา',
    'upload.licenseLabel': 'ใบประกอบวิชาชีพการพยาบาล',
    'upload.licenseHint': 'ใบอนุญาตจากสภาการพยาบาล',
    'upload.required': 'จำเป็น',
    'upload.dropHint': 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือก',
    'upload.sizeLimit': 'PDF ≤ 10 MB',
    'upload.uploaded': 'อัปโหลดสำเร็จ',
    'upload.attached': 'แนบ{label}เรียบร้อย',

    'review.title': 'ตรวจทานก่อนส่ง',
    'review.sub': 'โปรดตรวจสอบความถูกต้อง เมื่อส่งแล้วสถานะจะเปลี่ยนเป็น "รอตรวจสอบ"',
    'review.submitBtn': 'ยืนยันและส่งผลสอบ',
    'review.submitToast': 'ส่งผลสอบเรียบร้อย · รอเจ้าหน้าที่ตรวจสอบ',

    'statuspage.title': 'สถานะการกรอกผลสอบ',
    'statuspage.sub': 'รอบที่ {attempt} ปีการศึกษา {year}',
    'statuspage.historyBtn': 'ดูประวัติ',
    'statuspage.currentStatus': 'สถานะปัจจุบัน',
    'statuspage.submittedNote': 'ส่งเมื่อ {date} · เจ้าหน้าที่จะตรวจสอบภายใน 3 วันทำการ',
    'statuspage.subjectSummaryTitle': 'ผลสอบรายวิชาที่กรอก',
    'statuspage.timelineTitle': 'ไทม์ไลน์การตรวจสอบ',
    'statuspage.timeline.0': 'กรอกและส่งผลสอบ',
    'statuspage.timeline.1': 'เจ้าหน้าที่ตรวจสอบ',
    'statuspage.timeline.2': 'ยืนยันผลเรียบร้อย',
    'statuspage.inProgress': 'อยู่ระหว่างดำเนินการ',
    'statuspage.waitConfirm': 'รอการยืนยัน',
    'statuspage.infoNote': 'ยังแก้ไขผลสอบได้จนกว่าเจ้าหน้าที่จะเริ่มตรวจสอบ',

    'historypage.title': 'ประวัติการกรอกผลสอบ',
    'historypage.sub': 'บันทึกการกรอกของคุณทุกรอบที่ผ่านมา',
    'historypage.colRound': 'รอบการสอบ',
    'historypage.colDate': 'วันที่กรอก',
    'historypage.colResult': 'ผลสอบ',
    'historypage.colStatus': 'สถานะ',
    'historypage.roundPrefix': 'รอบ {round}',
    'historypage.editBtn': 'แก้ไข',
    'historypage.viewBtn': 'ดู',
  },
  EN: {
    'status.DRAFT': 'Not started',
    'status.SUBMITTED': 'Pending review',
    'status.CONFIRMED': 'Confirmed',
    'status.REJECTED': 'Rejected',
    'pass.true': 'Pass',
    'pass.false': 'Fail',
    'pass.none': '—',

    'topbar.title': 'Nursing License Record System',
    'topbar.subtitle': 'Faculty of Nursing · Prince of Songkla University',
    'topbar.notifTitle': 'Notifications',
    'topbar.notifEmptyTitle': 'No notifications yet',
    'topbar.notifEmptySub': 'New notifications will show up here',
    'topbar.switchRole': 'Switch role view (demo)',
    'topbar.logout': 'Log out',

    'role.student': 'Student',
    'role.officer': 'Faculty Officer',
    'role.executive': 'Faculty Executive',
    'role.admin': 'Administrator',

    'sidebar.footerPrefix': 'Signed in as',

    'nav.student.news': 'News / Announcements',
    'nav.student.form': 'Submit Exam Results',
    'nav.student.status': 'Submission Status',
    'nav.student.history': 'Submission History',

    'news.pageTitle': 'News / Announcements',
    'news.pageSub': 'Follow schedules and guidelines from the faculty',
    'news.openRoundChip': 'Currently open',
    'news.roundLine': 'Round {attempt}, Academic Year {year}',
    'news.openPeriod': 'Open {open} – {close}',
    'news.yourStatus': 'Your submission status',
    'news.startBtn': 'Start submission',
    'news.pinned': 'Pinned',
    'news.postedBy': 'Posted by: {author}',
    'common.close': 'Close',

    'examform.pageTitle': 'Submit Exam Results',
    'examform.pageSub': 'Round {attempt}, Academic Year {year} · Closes {close}',
    'examform.crumbHome': 'Home',
    'examform.crumbForm': 'Submit results',
    'examform.steps.0': 'Council info',
    'examform.steps.1': 'Exam results',
    'examform.steps.2': 'Attach files',
    'examform.steps.3': 'Review',

    'examform.council.title': 'Nursing Council Account',
    'examform.council.sub': 'Used to reference results from the Council system (one-time entry, reused every round)',
    'examform.council.emailLabel': 'Nursing council email',
    'examform.council.passwordLabel': 'Nursing council password',
    'examform.council.savedNote': 'Already saved · no need to re-enter next round',

    'common.next': 'Next',
    'common.back': 'Back',
    'examform.nextUpload': 'Next: attach files',
    'examform.nextReview': 'Next: review',

    'examresults.title': 'Subject Results (8 subjects)',
    'examresults.subToggle': 'Mark each subject as "Pass" or "Fail"',
    'examresults.subCards': 'Tap a card to select the result for each subject',
    'examresults.allPassBtn': 'Mark all as pass',

    'progress.title': 'Progress',
    'progress.filled': 'completed',
    'progress.legendPass': 'Pass',
    'progress.legendFail': 'Fail',
    'progress.legendNone': 'Unmarked',
    'progress.saved': 'Draft auto-saved',
    'progress.saving': 'Saving…',

    'upload.allPassNote': 'You passed all 8 subjects — please attach both the exam result slip and the nursing license.',
    'upload.partialNote': 'Some subjects are not yet passed — attaching the exam result slip is enough for now (attach the license once you pass all subjects).',
    'upload.examLabel': 'Exam result slip',
    'upload.examHint': 'Results for all 8 subjects',
    'upload.licenseLabel': 'Nursing License',
    'upload.licenseHint': 'License issued by the Nursing Council',
    'upload.required': 'Required',
    'upload.dropHint': 'Drag a file here, or click to browse',
    'upload.sizeLimit': 'PDF ≤ 10 MB',
    'upload.uploaded': 'Uploaded',
    'upload.attached': '{label} attached',

    'review.title': 'Review before submitting',
    'review.sub': 'Please check everything is correct — once submitted, status changes to "Pending review"',
    'review.submitBtn': 'Confirm & submit',
    'review.submitToast': 'Submitted successfully · awaiting officer review',

    'statuspage.title': 'Submission Status',
    'statuspage.sub': 'Round {attempt}, Academic Year {year}',
    'statuspage.historyBtn': 'View history',
    'statuspage.currentStatus': 'Current status',
    'statuspage.submittedNote': 'Submitted {date} · will be reviewed within 3 business days',
    'statuspage.subjectSummaryTitle': 'Submitted subject results',
    'statuspage.timelineTitle': 'Review timeline',
    'statuspage.timeline.0': 'Submitted results',
    'statuspage.timeline.1': 'Officer review',
    'statuspage.timeline.2': 'Confirmed',
    'statuspage.inProgress': 'In progress',
    'statuspage.waitConfirm': 'Awaiting confirmation',
    'statuspage.infoNote': 'You can still edit your results until an officer starts reviewing',

    'historypage.title': 'Submission History',
    'historypage.sub': 'Your submission record for every past round',
    'historypage.colRound': 'Round',
    'historypage.colDate': 'Submitted on',
    'historypage.colResult': 'Result',
    'historypage.colStatus': 'Status',
    'historypage.roundPrefix': 'Round {round}',
    'historypage.editBtn': 'Edit',
    'historypage.viewBtn': 'View',
  },
};

export function t(lang, key, vars) {
  const s = (DICT[lang] && DICT[lang][key]) ?? DICT.TH[key] ?? key;
  if (!vars) return s;
  return Object.keys(vars).reduce((acc, k) => acc.replaceAll('{' + k + '}', vars[k]), s);
}

/* pick a `${field}_en` variant off a mock-data object when lang is EN and it exists, else fall back to `field` */
export function pick(lang, obj, field) {
  if (lang === 'EN' && obj[field + '_en']) return obj[field + '_en'];
  return obj[field];
}
