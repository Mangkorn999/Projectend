/* ============================================================
   User manual — Faculty Officer (English edition)
   ฉบับภาษาอังกฤษของ userManual.jsx — โครงหมวด/ลำดับข้อ/ชื่อภาพสาธิต (<Demo name=...>) ตรงกับฉบับไทยทุกหมวด
   แก้เนื้อหาฉบับไทยเมื่อไหร่ ต้องมาแก้ที่นี่ให้ตรงกันด้วย (ข้อความบนปุ่ม/เมนูใช้คำเดียวกับ i18n.js ฝั่ง EN ของระบบจริง)
   ============================================================ */
import { Demo } from './manualDemos.jsx';
import { Callout, Proc } from './manualParts.jsx';

export const COVER_EN = {
  org: 'Faculty of Nursing, Prince of Songkla University',
  title: 'User Manual — Nursing License Record System',
  sub: 'For Faculty Officers',
  metaUpdated: 'Last updated',
  metaUpdatedValue: '6 October 2026',
  metaAudience: 'Audience',
  metaAudienceValue: 'Faculty Officer',
  metaType: 'Document type',
  metaTypeValue: 'Internal use within the Faculty',
  print: 'Print manual',
  toc: 'Contents',
  tocAria: 'Manual contents',
  appendixShort: 'Appendix',
  appendixLetter: 'A',
};

export const SECTIONS_EN = [
  {
    id: 'intro', title: 'Introduction and access rights',
    body: (
      <>
        <h3>1.1 Purpose</h3>
        <p>The Nursing License Record System is used to record and follow up the results of nursing students&apos; professional licensing examinations,
          so that the Faculty can check, confirm and report exam results accurately, systematically and with a traceable history.
          This manual is written for <b>Faculty Officers</b> as a working guide to the system.</p>
        <h3>1.2 User groups and permissions</h3>
        <table className="mn-table">
          <thead><tr><th style={{ width: '24%' }}>User group</th><th>Summary of permissions</th></tr></thead>
          <tbody>
            <tr><td><b>Student</b></td><td>Enters subject results and attaches the exam report (PDF files or JPG/PNG photos, up to 5 files) in the round that is open, follows the review status, and sees their own history and announcements for their own cohort.</td></tr>
            <tr><td><b>Faculty Officer</b></td><td>Uses every menu: review, confirm, reject, edit review decisions, manage student records, import students, manage rounds and subjects, manage users, post announcements and produce reports.</td></tr>
            <tr><td><b>Assistant reviewer</b></td><td>Helps the officer review results: opens evidence files, confirms and rejects results, and views student details to support the review (cannot edit anything else; does not see the management and export menus). A Faculty Officer adds these accounts in the &quot;User management&quot; menu (section 8).</td></tr>
            <tr><td><b>Faculty Executive</b></td><td>Views the dashboard, overall statistics and summary reports (read-only; cannot edit data).</td></tr>
          </tbody>
        </table>
        <Callout type="note"><p>Permissions are set by the system for each account. Menus you are not allowed to use are not shown, and if you type the address of such a page yourself the system will not allow access.</p></Callout>
      </>
    ),
  },
  {
    id: 'login', title: 'Signing in',
    body: (
      <>
        <Proc>
          <li>Open the system in a web browser, enter your <b>username</b> and <b>password</b>, then choose &quot;Sign in&quot;.</li>
          <li>For staff accounts (officers, assistant reviewers, executives) created or reset by a Faculty Officer, the system forces you to <b>set a new password</b> before you can use it. The password must be at least 8 characters and must differ from the previous one. (A student account that was reset back to the national ID number can sign in immediately and is not forced to change it.)</li>
          <li>When you finish, choose your name at the top right and then &quot;Sign out&quot; — every time, especially on a shared computer.</li>
        </Proc>
        <Callout type="warn"><p>If a wrong password is entered more than 10 times within 15 minutes, the system temporarily blocks sign-in for that username for security. Please wait a little and try again.</p></Callout>
        <Callout type="note"><p>A student&apos;s initial password is their <b>13-digit national ID number</b>. A student signs in for the first time and must complete the profile before the other menus can be used.</p></Callout>
      </>
    ),
  },
  {
    id: 'dashboard', title: 'Dashboard — exam results summary',
    body: (
      <>
        <p>The dashboard shows an overview of exam results. Choose the academic year and exam round at the top right of the page; every figure on the page changes immediately.</p>
        <ul>
          <li><b>Status breakdown</b> — the number of papers confirmed, pending review and rejected, and students who have not submitted.</li>
          <li><b>Subject pass rate</b> — click the &quot;Pass&quot; or &quot;Fail&quot; number of a subject to open a window on the dashboard listing the students (name, ID, room),
            and click &quot;Export&quot; in that window to save the list as Excel or PDF (the figures are for the selected round, or for the whole year when the &quot;Whole year&quot; tab is selected).</li>
          <li><b>First-attempt pass rate, last 3 years</b> (the &quot;Report statistics&quot; tab) — each year&apos;s card has a &quot;view the students who passed / did not pass&quot; link that opens the Student Records page to show the list on screen.
            The cards have no export button — the full lists are downloaded from the &quot;Summary Reports&quot; menu (see section 10.2).</li>
          <li><b>First-attempt pass rate and the distribution of subjects passed</b> — available in the &quot;Whole year&quot; view. This set of figures matches the numbers the Faculty reports to the Thailand Nursing and Midwifery Council.</li>
          <li><b>Year-on-year comparison</b> — compare up to 3 academic years.</li>
        </ul>
        <Demo name="dashSubject" />
        <Callout type="warn" title="How figures are counted">
          <p><b>Every &quot;pass&quot; figure counts only confirmed papers</b>: passed every subject, passed on first attempt, passed within the first year, subject pass rates, the table of how many subjects were passed, and per-room totals.
            Results typed in by students have not yet been checked against the exam report, so papers that are <u>pending review</u> or <u>rejected</u> are not counted as passes. Every percentage is calculated from the <b>whole cohort</b>,
            <b> including students who were imported but have never signed in</b> (counted as &quot;Not started&quot;), so the &quot;whole cohort&quot; total on the dashboard matches the number imported.</p>
          <p>While review is incomplete the figures are temporarily lower than the truth and rise as papers are confirmed. The dashboard therefore shows a yellow bar saying &quot;N papers are still pending review and not yet counted&quot; — finish the review before producing a report for an outside body.</p>
        </Callout>
        <p>When you open Student Records from a list on the dashboard, a &quot;Back to dashboard&quot; button appears so you can return to the same position you had selected.</p>
      </>
    ),
  },
  {
    id: 'review', title: 'Reviewing and confirming exam results',
    body: (
      <>
        <p>The &quot;Review &amp; Confirm&quot; menu shows the exam results students have submitted, separated into the tabs Pending review, Rejected, Confirmed and Not started. The number on the menu is the count of papers waiting for review.
          Faculty officers and assistant reviewers use the same queue, and can review both while the round is open and after it has closed.</p>
        <h3>4.1 Confirming results</h3>
        <Demo name="approve" />
        <Callout type="note">
          <p>Once confirmed, the student <b>can no longer edit the results of that round</b>, and the dashboard and report figures start counting this paper.</p>
        </Callout>
        <Callout type="warn">
          <p><b>A paper with no evidence file attached cannot be confirmed.</b> The &quot;Confirm results&quot; button is disabled with a message giving the reason (this can happen when the student submitted results but the file upload failed, or removed all files).
            Use &quot;Reject for correction&quot; with a reason such as &quot;The exam report file has not been attached&quot;. Rejecting works as normal.</p>
        </Callout>
        <h3>4.2 Rejecting for correction</h3>
        <Demo name="reject" />
        <Callout type="note" title="Rejecting after the round has closed">
          <p>A student can correct and resubmit a rejected paper <b>even after the submission round has closed</b>, so you can review and reject after the round closes without extending the closing date.
            The student receives a notification with the reason, and on opening the submission page sees the original paper with the rejection reason, corrects the results or attaches new files, and clicks &quot;Resubmit results&quot;.
            The paper returns to the &quot;Pending review&quot; tab for another review.</p>
          <p>This exception applies to papers that are <b>rejected</b> only. A student who has never submitted, or whose paper is still pending review, cannot submit or edit after the round closes (extend the closing date — see section 7.3).</p>
        </Callout>
        <h3>4.3 Editing a review decision</h3>
        <p>A paper that has been decided (confirmed or rejected) has a single button, <b>&quot;Edit review decision&quot;</b>. Clicking it returns the paper to &quot;Pending review&quot;, after which you can confirm or reject again.
          The &quot;Confirm&quot; and &quot;Reject&quot; buttons are shown only for papers pending review, so a paper cannot be confirmed twice or rejected twice (Faculty Officers only).</p>
        <Demo name="revoke" />
        <Callout type="note"><p>Every edit of a review decision requires a reason, and the system keeps a history for later audit. An edited paper goes back to &quot;Pending review&quot;,
          which the student can edit only while the round is still open. If the round has closed and the student needs to correct it, reject the paper with a reason (section 4.2).</p></Callout>

        <h3>4.4 Evidence files attached by the student</h3>
        <ul>
          <li>A student can attach the exam report as <b>several files, up to 5 per paper</b>, as <b>PDF</b> or <b>photos (JPG, PNG)</b>, up to 10 MB each — on a phone they can photograph the exam report and attach it straight away.</li>
          <li>The student detail page lists every file with its document type (exam report / professional licence) and file type (PDF / image). Click &quot;View&quot; to open each file in a new browser window, and check every file before confirming.</li>
          <li>For a paper submitted before the round closed, the student can attach more files for up to 15 minutes after closing (a grace period for slow connections near the deadline). After that, files cannot be attached or removed, except on rejected papers.</li>
          <li>If a photo is unclear or incomplete, reject with a reason such as &quot;The score sheet photo is unclear, please attach it again&quot;. The student can remove the old file and attach a new one when resubmitting.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'students', title: 'Managing student records',
    body: (
      <>
        <h3>5.1 Searching, filtering and exporting the list</h3>
        <p>Search by name or student ID, and filter by status, room, graduation academic year and submission access. Under the page title the count is shown against the number matching the filters, for example &quot;Showing 10 of 928&quot;, which becomes &quot;Showing 20 of 928&quot; on the next page. When a search or filter is active, the total number of students is appended, for example &quot;Showing 1 of 1 · Total 928&quot;.
          The &quot;Export data (N)&quot; button at the top right exports <b>only the list currently filtered on screen</b>. It is a menu with 2 options: (1) Student data (Excel) and (2) Student data by exam round (Excel with several sheets: the first sheet holds the student data, and each exam round has one sheet).
          The student data contains name (Thai and English), room, graduation year, email, phone, submission access and the status of the latest paper. The file <b>does not contain the national ID number</b> — N is the number of people who will be in the file.
          The pass / fail lists (first attempt, within the first year, per subject) are not exported from this page; use the &quot;Summary Reports&quot; menu (section 10.2).
          Students who have never signed in to complete their profile do not appear on this page, but can be seen in the &quot;Accounts not yet signed in&quot; tab (section 6.7). They are still counted as students of the cohort in the statistics (status &quot;Not started&quot;) and appear in the &quot;did not pass&quot; list files (name and room columns empty).</p>

        <h3>5.2 Submission access</h3>
        <p>A student can submit results only when (a) an officer has granted submission access and (b) a submission round for their own cohort is open. Access can be granted or revoked one student at a time, or for several students at once by ticking them.</p>
        <Demo name="eligible" />

        <h3>5.3 Editing student details</h3>
        <p>Use this to correct details a student entered wrongly, or to adjust the graduation academic year of a repeating or deferred student. The graduation year can be changed only for students who <b>have never submitted results</b>,
          because moving a cohort after results exist would skew the statistics of the original cohort.</p>
        <Demo name="editStudent" />

        <h3>5.4 Resetting a student&apos;s password</h3>
        <p>Use this when a student forgot their password or you suspect someone else is using the account. A student&apos;s password is their national ID number, so a reset sets the password back to the national ID number you enter.</p>
        <Demo name="resetStudent" />
        <Callout type="note"><p>The reset button is on the &quot;Student Records&quot; page, which shows only students who have signed in and completed their profile. For an account that has <u>never signed in</u> (for example, the national ID was imported wrongly),
          delete it in the &quot;Accounts not yet signed in&quot; tab and import it again (section 6.7).</p></Callout>

        <h3>5.5 Deleting a student</h3>
        <p>Choose &quot;Delete&quot; on the student&apos;s row, or &quot;Delete student&quot; on the detail page, or tick several students and choose &quot;Delete selected&quot;. The system always shows a confirmation window before it proceeds.</p>
        <Demo name="deleteStudent" />
        <Callout type="danger">
          <p>A student <b>can be deleted in every case, including students who already have exam results</b>, and all of that person&apos;s results, evidence files and review history are deleted with them.
            The cohort statistics change retroactively, and figures in reports already issued may no longer match the system. <b>This cannot be undone.</b></p>
          <p>Before deleting someone who has results, keep a PDF copy of that round&apos;s report and check the names in the confirmation window. When deleting several people at once and some of them have results,
            the confirmation window tells you how many have results before you delete.</p>
        </Callout>
      </>
    ),
  },
  {
    id: 'import', title: 'Importing students',
    body: (
      <>
        <p>The &quot;Import Students&quot; menu adds students to the system. It has 3 tabs: <b>Import File (Excel / CSV)</b>, <b>Enter One at a Time</b> and <b>Accounts not yet signed in</b>.
          The result of an import is a <b>user account</b> that uses the student ID as the username and the national ID number as the initial password. Students enter their own name, email, phone and room when they sign in for the first time.</p>

        <h3>6.1 Data required in the file</h3>
        <table className="mn-table">
          <thead><tr><th style={{ width: '22%' }}>Data</th><th style={{ width: '22%' }}>Column name in the sample file</th><th>Details</th></tr></thead>
          <tbody>
            <tr><td>Student ID</td><td>รหัสนักศึกษา (Student ID)</td><td>10 digits, e.g. 6610210631 (required) — the first 2 digits are used to work out the graduation academic year</td></tr>
            <tr><td>National ID number</td><td>เลขบัตรประชาชน (National ID)</td><td>13 digits (required) — the student&apos;s initial password</td></tr>
            <tr><td>Graduation academic year</td><td>ปีการศึกษาที่จบ (Graduation year)</td><td>Optional. Fill it only for repeating or deferred students. If left empty the system works it out from the student ID (ID + 4 years)</td></tr>
          </tbody>
        </table>
        <ul>
          <li>The &quot;Download sample file&quot; button gives an Excel file with the column headings in the table above, with every column already formatted as text so you can type 13-digit national IDs without them being reformatted.</li>
          <li>The file must have a heading row first and be no larger than 5 MB (roughly several thousand rows; split a larger file into several).</li>
          <li>If the number contains hyphens or spaces (e.g. <code>1-9299-00326-09-1</code>) or Thai numerals, the system converts it to plain digits itself.</li>
          <li>The system does not guess missing digits: a number that Excel has already truncated is not imported (see the warning in section 6.2).</li>
        </ul>

        <h3>6.2 Importing from a file</h3>
        <Demo name="import" />
        <Callout type="warn">
          <p><b>Import the Excel file (.xlsx) directly.</b> Do not open the file in Excel and &quot;Save as CSV&quot;, because Excel shortens 13-digit national IDs into a form such as <code>1.23E+12</code>,
            permanently losing part of the number with no way to recover it (the system will not import that row and tells you why). If you have to type national IDs yourself, set that column to &quot;Text&quot; before typing and the problem is avoided.</p>
        </Callout>
        <Callout type="note"><p>&quot;Check file&quot; is only a check — <b>nothing is saved</b> until you choose &quot;Import&quot;, so you can cancel and fix the file with no effect on the system.
          The system never overwrites a student that already exists (that row is skipped with the reason &quot;Already in the system&quot;).</p></Callout>
        <Callout type="note"><p><b>Large imports take time:</b> about 1 minute per 1,000 students, because the system sets each student&apos;s password individually. During this the screen shows an &quot;Importing students&quot; bar with the elapsed time.
          Please wait for the summary message, <b>do not close the page and do not click again</b> (the button is disabled while working, and even if you click twice the system does not create duplicate accounts — existing rows are skipped).</p></Callout>

        <h3>6.3 When the column names in the file are not recognised</h3>
        <p>The system reads the column headings and guesses which is which, looking for words such as &quot;รหัสนักศึกษา&quot; (student ID), &quot;เลขบัตร&quot; (national ID) and &quot;ปีจบ&quot; (graduation year). If whoever built the form named the questions differently, or many other columns are mixed in,
          the system does not reject the file but asks you to <b>choose which column is which</b>.</p>
        <Demo name="mapping" />

        <h3>6.4 When the check finds problem rows</h3>
        <p>The system checks every row separately. Problem rows are skipped without failing the whole file, and the reason is given per row (row numbers match what you see in the spreadsheet program).</p>
        <Demo name="skipped" />
        <table className="mn-table">
          <thead><tr><th style={{ width: '38%' }}>Reason shown</th><th>How to fix it</th></tr></thead>
          <tbody>
            <tr><td>Incomplete data</td><td>The row is missing the student ID or national ID — fill them in and import just that row again.</td></tr>
            <tr><td>National ID must be exactly 13 digits</td><td>Check the number of digits and stray characters (the system already removes hyphens and spaces and converts Thai numerals).</td></tr>
            <tr><td>National ID was converted by Excel to scientific notation</td><td>The digits are already lost and cannot be recovered — use the original .xlsx file, or retype the number in a column set to text.</td></tr>
            <tr><td>Student ID must be 10 digits, e.g. 6610210631</td><td>Check that row&apos;s student ID.</td></tr>
            <tr><td>Student ID duplicates row N in the same file</td><td>The system keeps the first row and skips the later one — delete the duplicate, or check whether the ID was mistyped.</td></tr>
            <tr><td>Already in the system</td><td>This student has already been imported and the system does not overwrite. To change details, edit them on the student detail page (section 5.3). If the national ID is wrong, see section 11.</td></tr>
            <tr><td>Invalid graduation academic year</td><td>It must be a 4-digit B.E. year and not earlier than the year worked out from the ID (entry year + 4) — usually caused by entering the year of entry instead of the year of graduation.</td></tr>
          </tbody>
        </table>
        <p>If a student&apos;s graduation year differs from the one the ID implies, the system shows a &quot;Graduation year differs from ID&quot; table before you confirm. Check that they really are repeating or deferred, because the graduation year decides which cohort&apos;s exam rounds the student sees.</p>

        <h3>6.5 Importing data collected with a Google Form</h3>
        <p>Set up the Google Form as follows so it can be imported without choosing columns by hand.</p>
        <table className="mn-table">
          <thead><tr><th style={{ width: '24%' }}>Data</th><th style={{ width: '28%' }}>Recommended question title</th><th>Settings</th></tr></thead>
          <tbody>
            <tr><td>Student ID</td><td>รหัสนักศึกษา (Student ID)</td><td>Type &quot;Short answer&quot;, required. Under &quot;Response validation&quot; choose &quot;Regular expression&quot; and type <code>^\d{'{10}'}$</code> (accepts exactly 10 digits)</td></tr>
            <tr><td>National ID number</td><td>เลขบัตรประชาชน (National ID)</td><td>Type &quot;Short answer&quot;, required. Under &quot;Response validation&quot; choose &quot;Regular expression&quot; and type <code>^\d{'{13}'}$</code> (accepts exactly 13 digits)</td></tr>
            <tr><td>Graduation academic year</td><td>ปีที่จบ (Graduation year)</td><td>Not required (repeating / deferred students only). Under &quot;Response validation&quot; use <code>^\d{'{4}'}$</code> (accepts exactly 4 digits)</td></tr>
          </tbody>
        </table>
        <ul>
          <li>Export by choosing &quot;View in Sheets&quot; → File → Download → <b>Microsoft Excel (.xlsx)</b>, then import following section 6.2 (the system skips the &quot;Timestamp&quot; column that Google adds).</li>
          <li>If the questions are titled differently, or other questions contain the same keywords (for example &quot;Guardian&apos;s national ID number&quot;), the system cannot tell which column is correct and asks you to choose (section 6.3).</li>
        </ul>
        <Callout type="danger">
          <p>The national ID number is personal data and is also the student&apos;s initial password. Restrict access to the Google Sheet and the downloaded file to the officers concerned, and delete them once the import is finished.</p>
        </Callout>

        <h3>6.6 Adding one student at a time</h3>
        <p>Suitable for a few students added later. It uses the same data and rules as the file import (student ID and national ID required, graduation academic year optional).</p>
        <Demo name="manualAdd" />

        <h3>6.7 Checking and deleting accounts that have not signed in</h3>
        <p>The &quot;Accounts not yet signed in&quot; tab lists students who were imported but have not yet signed in to complete their profile for the first time, with the count on the tab, how long ago they were imported,
          a graduation-year filter, and a button to download the list (CSV) for following up with students. Use it to verify an import and to delete IDs that were imported wrongly.</p>
        <Demo name="pending" />
        <Callout type="note"><p>These accounts have no name or phone yet (students enter them later), so only the student ID is shown. Once a student signs in and completes the profile, they move to the &quot;Student Records&quot; page automatically
          and can no longer be deleted from this tab (delete them from &quot;Student Records&quot; as in section 5.5).</p></Callout>
      </>
    ),
  },
  {
    id: 'rounds', title: 'Managing exam rounds and subjects',
    body: (
      <>
        <h3>7.1 Opening a submission round</h3>
        <Demo name="round" />
        <h3>7.2 Round rules</h3>
        <ul>
          <li>The system lets <b>only one round be open for submission at a time</b>. If another round is still open it says &quot;Another round is open — close it before opening a new one&quot;.</li>
          <li>The same attempt number cannot be repeated within one academic year.</li>
          <li>For a round that <b>already has students&apos; results</b>, the academic year and attempt number cannot be changed (the system says the round already has results), because results would move to another cohort or change order. Only the open and close dates can be edited.</li>
          <li>Dates must exist in the calendar (for example 31 February is rejected).</li>
          <li>The opening date must be before the closing date, and a round whose closing date has already passed cannot be opened — change the closing date first.</li>
          <li>A closing time given to the minute (for example 23:59) means submissions are accepted until the end of that minute.</li>
          <li>Students see and submit only the round for their own cohort (the cohort matching their graduation academic year) and must have been granted submission access.</li>
          <li>While opening a round, the system shows how many students of the cohort will see it. If it says there are no students of that cohort in the system, opening it means nobody can submit — re-check the academic year.</li>
        </ul>
        <p>Round statuses shown on the cards</p>
        <table className="mn-table">
          <thead><tr><th style={{ width: '30%' }}>Status</th><th>Meaning and what to do</th></tr></thead>
          <tbody>
            <tr><td><b>Open for submission</b></td><td>Within the open–close dates; students can submit.</td></tr>
            <tr><td><b>Scheduled</b></td><td>Activated but the opening date has not arrived; students cannot submit yet. The system shows the opening date.</td></tr>
            <tr><td><b>Past closing date</b></td><td>The closing date has passed but the officer has not closed the round; students can no longer submit — close the round to finalise, or extend the closing date if they should keep submitting.</td></tr>
            <tr><td><b>Closed</b></td><td>The officer has closed the round; students cannot submit or edit, except rejected papers, which can still be corrected and resubmitted (section 4.2).</td></tr>
          </tbody>
        </table>

        <h3>7.3 Extending the closing date, or reopening a closed round</h3>
        <p>Use this when students who <b>have never submitted</b>, or papers that are <b>still pending review</b>, need to submit or edit after the round closed (rejected papers can already be corrected by the student without extending the closing date).
          A round with the status &quot;Past closing date&quot; returns to &quot;Open for submission&quot; simply by extending the closing date; a round that is &quot;Closed&quot; also needs the active box ticked.</p>
        <Demo name="extendRound" />

        <h3>7.4 Managing subjects</h3>
        <Demo name="subject" />
        <ul>
          <li>Subject codes must be unique.</li>
          <li>For a round that is <b>open for submission</b>, the examined subjects cannot be edited — close the round first (this stops results already entered by students from no longer matching the round&apos;s subjects).</li>
        </ul>

        <h3>7.5 Deleting rounds and subjects</h3>
        <ul>
          <li>A <b>round</b> can be deleted when it is <u>not open for submission</u> (closed, or past its closing date), has no student results, and has no announcement attached (delete the announcements first).</li>
          <li>A <b>subject</b> cannot be deleted if a round uses it or student results refer to it.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'users', title: 'Managing users (officers / assistant reviewers / executives)',
    body: (
      <>
        <p>The &quot;User management&quot; menu adds and maintains staff accounts. Staff cannot register themselves; only a Faculty Officer creates their accounts (to prevent impersonation).
          Student accounts are created from the &quot;Import Students&quot; menu. The roles you can create are below (the Add user window also shows a short description of each role&apos;s permissions).</p>
        <table className="mn-table">
          <thead><tr><th style={{ width: '24%' }}>Role</th><th>When to use it / what it can do</th></tr></thead>
          <tbody>
            <tr><td><b>Faculty Officer</b></td><td>The person responsible for the system; uses every menu.</td></tr>
            <tr><td><b>Assistant reviewer</b></td><td>Staff who help review results when many papers are waiting — can only review, confirm or reject results.
              Does not see the management and export menus and cannot edit review decisions. Close the account when the exam season is over (the review history is kept in full).</td></tr>
            <tr><td><b>Faculty Executive</b></td><td>Views the dashboard and summary reports only; does not see individual student data (email and phone are not needed).</td></tr>
          </tbody>
        </table>
        <h3>8.1 Adding a user</h3>
        <Demo name="userAdd" />
        <h3>8.2 Resetting a password, closing and deleting an account</h3>
        <Demo name="userAccess" />
        <ul>
          <li><b>Reset password</b> — sets a new temporary password for someone who forgot theirs. The old password stops working immediately, and the user must set a new password at the next sign-in.</li>
          <li><b>Close account</b> (revoke access) — blocks the account from signing in without deleting the account or its history (reviews and announcements the person made are all kept).</li>
          <li><b>Delete account</b> — permanently removes the account and cannot be undone. It can be used only for accounts created by mistake or in duplicate that have never done anything in the system. If the account has ever posted news, created a round or confirmed results, the system refuses (use &quot;Close account&quot; instead).</li>
        </ul>
        <Callout type="warn"><p>You cannot reset the password of, close, delete or change the role of your own account, to prevent accidentally locking yourself out. The system should therefore have at least 2 Faculty Officer accounts.</p></Callout>
        <Callout type="note"><p><b>Changing a role</b> (the &quot;Change role&quot; button) works on staff accounts — officers, assistant reviewers and executives — and takes effect immediately: a user with a page left open cannot perform actions they no longer have permission for, and sees the new menus after reloading the page (press F5).
          <b> Student accounts cannot change role</b> (if a former student should use the system as staff, create a new staff account).</p></Callout>
        <Callout type="note"><p><b>Restoring a closed account:</b> click &quot;Reset password&quot; on that account to set a new temporary password. The account works again and the user must set a new password when signing in.
          Always check the name before closing an account. Check the name before every &quot;Delete account&quot; too, because a deletion cannot be undone at all.</p></Callout>
      </>
    ),
  },
  {
    id: 'news', title: 'News and announcements',
    body: (
      <>
        <Demo name="news" />
        <ul>
          <li>Each announcement must have one &quot;Related round&quot; selected (required). Students see only announcements for rounds of their own cohort.</li>
          <li>One illustration image can be attached per announcement (JPG, PNG, WebP or GIF, up to 5 MB).</li>
          <li>Announcements can be edited or deleted later — students no longer see a deleted announcement.</li>
          <li>A round that has announcements attached cannot be deleted until the announcements are deleted first.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'reports', title: 'Summary reports',
    body: (
      <>
        <p>The &quot;Summary Reports&quot; menu shows summary figures for the selected round and academic year in the same format the Faculty uses to report to the Thailand Nursing and Midwifery Council: the percentage passing on the first attempt,
          the percentage passing within the first year, subject results of the first exam round, and the distribution of the number of subjects passed.</p>
        <h3>10.1 Viewing the report and subject lists</h3>
        <Demo name="report" />
        <h3>10.2 Exporting all data (the &quot;Export data&quot; panel)</h3>
        <p>Every kind of pass / fail list is exported from the &quot;Summary Reports&quot; page only (Faculty Officers only), using the &quot;Export data&quot; panel: choose the year and round at the top, then choose the file you need
          (the Student Records page can export only the list currently filtered, and the yearly cards on the dashboard have only a link to view the list). The &quot;Download PDF&quot; button at the top right saves the report currently on screen as a PDF at once, and the &quot;Print&quot; button opens the browser&apos;s print window.</p>
        <table className="mn-table">
          <thead><tr><th style={{ width: '32%' }}>File</th><th style={{ width: '14%' }}>Format</th><th>Contents</th></tr></thead>
          <tbody>
            <tr><td>Students who <b>passed on the first attempt</b> (selected year)</td><td>Excel / PDF</td><td>Those who passed every subject from exam round 1 — the count matches the figure on the year-comparison cards on the dashboard</td></tr>
            <tr><td>Students who <b>did not pass on the first attempt</b> (selected year)</td><td>Excel / PDF</td><td>The whole cohort not in the passed group, including those who have not submitted, have drafts, were rejected, or were imported but have never signed in (name and room empty), with the columns &quot;Status of round 1 paper&quot; and &quot;Subjects not passed&quot; giving the reason</td></tr>
            <tr><td>Students who <b>passed within the first year</b> (selected year)</td><td>Excel / PDF</td><td>Those who passed every subject in any round of that year (including rounds 2 and 3) — the count matches &quot;percentage passing within the first year&quot;</td></tr>
            <tr><td>Students who <b>did not pass within the first year</b> (selected year)</td><td>Excel / PDF</td><td>The whole cohort that has not passed every subject within that year, used to follow up those who must sit the exam themselves after the year ends</td></tr>
            <tr><td>Student data for the whole cohort (selected year)</td><td>Excel</td><td>Name (Thai and English), room, graduation year, email, phone, submission access and the status of the latest paper — no national ID number (the &quot;Student Records&quot; page can still export by exam round)</td></tr>
            <tr><td>Pass / fail lists per subject</td><td>Excel / PDF</td><td>Click the &quot;Pass&quot; / &quot;Fail&quot; number in the subject table of the report, or in the subject pass-rate card on the dashboard, then choose &quot;Export&quot; in the list window</td></tr>
          </tbody>
        </table>
        <Demo name="exportPanel" />
        <Callout type="note"><p>The &quot;pass / fail within the first year&quot; lists can be exported only from this panel.
          Passed within the first year + did not pass within the first year always equals the whole cohort, and only confirmed papers are counted, like the other figures — so finish reviewing outstanding papers before exporting at the end of round 3.</p></Callout>
        <Callout type="note"><p>Passed on the first attempt + did not pass on the first attempt always equals the whole cohort, and &quot;passed on the first attempt&quot; counts only round 1 papers that are <b>confirmed</b> (matching the year-comparison cards and the &quot;view students&quot; button).
          Students whose paper is still pending review appear in the &quot;did not pass on the first attempt&quot; file, with the column &quot;Status of round 1 paper&quot; saying &quot;Pending review&quot; (and showing how many subjects they entered as passed). Once confirmed they move to the &quot;passed on the first attempt&quot; file automatically — so finish the review before exporting for a report.</p></Callout>
        <Callout type="danger"><p>Exported files contain personal data (name, email, phone). Keep them and pass them on only to the people concerned, and delete them when no longer needed.</p></Callout>
        <Callout type="warn"><p>Report figures are calculated from the data in the system at the time the report is produced. If students are deleted or review decisions edited afterwards, the figures change with the current data.
          Keep the PDF file as sent as evidence for any report submitted to an outside body.</p></Callout>
      </>
    ),
  },
  {
    id: 'faq', title: 'Common situations and how to fix them',
    body: (
      <>
        <p>This table collects problems officers often meet, with the usual causes and the fixes available in the system.</p>
        <h3>11.1 Students</h3>
        <table className="mn-table">
          <thead><tr><th style={{ width: '28%' }}>Situation</th><th>Common causes and how to fix it</th></tr></thead>
          <tbody>
            <tr><td>A student cannot sign in for the first time</td><td>Check that the student ID and national ID that were imported are correct by looking in the &quot;Accounts not yet signed in&quot; tab (section 6.7) — if the national ID or student ID was imported wrongly, delete that account and import it again correctly.
              If the wrong password was typed many times the system blocks sign-in temporarily; wait about 15 minutes and try again.</td></tr>
            <tr><td>A student forgot their password, or cannot sign in after signing in before</td><td>Use &quot;Reset password&quot; on the &quot;Student Records&quot; page (section 5.4). The password goes back to the national ID number you enter.</td></tr>
            <tr><td>A student says they cannot see the submission form</td><td>Check in order: (1) has submission access been granted (section 5.2); (2) is a round for their cohort open — the badge must say &quot;Open for submission&quot;, not &quot;Scheduled&quot; or &quot;Past closing date&quot;;
              (3) does the student&apos;s graduation academic year match the round&apos;s cohort — if not, fix it as in section 5.3 (possible while they have not submitted results).</td></tr>
            <tr><td>A repeating or deferred student sees the exam round of another cohort</td><td>The system ties rounds to the graduation academic year. Check or correct the student&apos;s graduation year (section 5.3), or give it in the import file from the start (the graduation year column).</td></tr>
            <tr><td>A student submitted but cannot edit</td><td>A &quot;Confirmed&quot; paper cannot be edited by the student; edit the review decision (section 4.3). A &quot;Rejected&quot; paper can always be corrected even after the round closes, while a &quot;Pending review&quot; paper can be edited only while the round is open — if the round has closed and the student must correct it, reject with a reason (section 4.2).</td></tr>
            <tr><td>Rejecting a paper after the round has closed</td><td>This works as normal. The student can still correct and resubmit a rejected paper without extending the closing date. When resubmitted, the paper returns to the &quot;Pending review&quot; tab.</td></tr>
            <tr><td>A student says they cannot attach a file</td><td>The system accepts only PDF, JPG and PNG files up to 10 MB each and up to 5 files per paper, and gives the reason per file on screen — suggest removing unneeded files, reducing the file size, or taking the photo again (photos from most phone cameras are under 10 MB).</td></tr>
            <tr><td>Deleted the wrong student</td><td>It cannot be restored. Import the student again (section 6.6). The student must complete the profile and enter the results again, and an officer must review them again. The deleted results cannot be recovered.</td></tr>
          </tbody>
        </table>

        <h3>11.2 Importing students</h3>
        <table className="mn-table">
          <thead><tr><th style={{ width: '28%' }}>Situation</th><th>Common causes and how to fix it</th></tr></thead>
          <tbody>
            <tr><td>A row says &quot;Already in the system&quot;</td><td>The system does not overwrite an existing student. To change details, edit them on the student detail page (section 5.3). If the account has never signed in and the national ID was imported wrongly, delete it in the &quot;Accounts not yet signed in&quot; tab and import it again.</td></tr>
            <tr><td>National ID shows as 1.23E+12</td><td>It happened by saving as CSV in Excel; the digits are lost. Use the original .xlsx file, or set the column to &quot;Text&quot; before retyping the numbers (section 6.2).</td></tr>
            <tr><td>The system says &quot;file is missing a column&quot; or asks you to choose columns</td><td>The column names are not ones the system recognises. Choose the right columns yourself (section 6.3), or change the headings to &quot;รหัสนักศึกษา&quot; / &quot;เลขบัตรประชาชน&quot;.</td></tr>
            <tr><td>Import succeeded but some rows were skipped</td><td>Look at the skipped rows with their reasons, download them as CSV to fix them, then upload only the corrected rows (section 6.4).</td></tr>
            <tr><td>The file is over 5 MB or cannot be read</td><td>Split it into several files, and use only Excel (.xlsx) or text CSV files.</td></tr>
            <tr><td>The whole batch was imported wrongly (for example, the wrong cohort&apos;s file)</td><td>Go to the &quot;Accounts not yet signed in&quot; tab, filter by graduation year, then &quot;Select all&quot; → &quot;Delete selected&quot; (section 6.7). This works only for accounts nobody has signed in to yet.</td></tr>
          </tbody>
        </table>

        <h3>11.3 Rounds, users and reports</h3>
        <table className="mn-table">
          <thead><tr><th style={{ width: '28%' }}>Situation</th><th>Common causes and how to fix it</th></tr></thead>
          <tbody>
            <tr><td>Cannot open a new round — the system says another round is open</td><td>Only one round can be open at a time. Close the open round first (edit it and untick &quot;Active&quot;).</td></tr>
            <tr><td>Cannot open a round — the system says the closing date has passed</td><td>Change the &quot;Closing date&quot; to a future date in the same edit (section 7.3).</td></tr>
            <tr><td>Cannot delete a round</td><td>It must not be open for submission (close it first) and must have no student results or announcements attached. The system tells you how many are blocking it.</td></tr>
            <tr><td>Cannot edit a round&apos;s subjects</td><td>A round that is open cannot have its subjects edited; close the round first.</td></tr>
            <tr><td>Cannot delete a subject</td><td>The subject is used by a round or referred to by student results.</td></tr>
            <tr><td>An executive says they cannot edit data</td><td>This is by design: executives are read-only. A Faculty Officer must make the edit.</td></tr>
            <tr><td>An officer or assistant reviewer forgot their password</td><td>Another Faculty Officer resets it in the &quot;User management&quot; menu (section 8.2). If there is no other officer, contact the system developer.</td></tr>
            <tr><td>Many papers are pending review and you cannot keep up</td><td>Add &quot;Assistant reviewer&quot; accounts in the &quot;User management&quot; menu (section 8.1). Assistants use the same review queue as officers, and can be closed at the end of the exam season.</td></tr>
            <tr><td>Cannot confirm results (button greyed out)</td><td>The paper has no evidence file attached. Reject it with a reason so the student attaches a file, then review again (section 4.1).</td></tr>
            <tr><td>Cannot change a round&apos;s academic year / attempt number</td><td>That round already has student results; only the open–close dates can be edited. If you created the round with the wrong year, delete it (if it has no results yet) and create it again (section 7.2).</td></tr>
            <tr><td>&quot;Pass&quot; figures on the dashboard or report are lower than expected</td><td>The system counts only <b>confirmed</b> papers. Papers pending review or rejected are not counted yet (see the yellow bar &quot;N papers still pending review&quot;). Review and confirm the outstanding papers (section 4.1) and the figures rise immediately. Figures follow the current data if students are deleted or review decisions edited.</td></tr>
            <tr><td>A student cannot choose a room when completing the profile</td><td>There are no rooms in the system yet. Ask the system administrator to add rooms first.</td></tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: 'cautions', title: 'Good practice and cautions',
    body: (
      <>
        <table className="mn-table">
          <thead><tr><th style={{ width: '30%' }}>Topic</th><th>Practice</th></tr></thead>
          <tbody>
            <tr><td>Deleting students</td><td>A deletion cannot be undone, and if the student has results their results, documents and review history are deleted too. Cohort statistics change retroactively. Check the names every time.</td></tr>
            <tr><td>National ID number</td><td>It is personal data and the initial password. Restrict access to files and tables containing it, and delete them when no longer needed.</td></tr>
            <tr><td>Import files</td><td>Use the .xlsx file directly; never save as CSV from Excel; and always check the file before confirming the import.</td></tr>
            <tr><td>Rejecting and editing review decisions</td><td>State clearly what must be corrected (for example, which file is unclear). Students can correct a rejected paper even after the round closes, while a paper whose review decision was edited goes back to pending review and you must review it again yourself.</td></tr>
            <tr><td>Exam rounds</td><td>Open one at a time, check the open–close dates before saving, and extend the closing date only when students who have not yet submitted must be allowed to.</td></tr>
            <tr><td>Assistant reviewer accounts</td><td>Create only as many as needed during the review period, and close them when the exam season ends.</td></tr>
            <tr><td>Closing a user account</td><td>Check the name before every confirmation. If the wrong person was closed, restore access with the &quot;Reset password&quot; button (section 8.2).</td></tr>
            <tr><td>Deleting a user account</td><td>It cannot be undone at all. Use it only for accounts created by mistake or in duplicate that have never been used. If the account has any history (news posted / rounds created / results confirmed) the system will not delete it; close it instead.</td></tr>
            <tr><td>User accounts</td><td>Do not share passwords, sign out whenever you finish, and close the account of anyone who has left the role immediately.</td></tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: 'appendix', title: 'Appendix: Meaning of statuses',
    body: (
      <table className="mn-table">
        <thead><tr><th style={{ width: '26%' }}>Status</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><td><b>Not started</b></td><td>The student has not submitted results for that round.</td></tr>
          <tr><td><b>Pending review</b></td><td>The student has submitted; waiting for a Faculty Officer or assistant reviewer to review. The student can overwrite it while the round is open.</td></tr>
          <tr><td><b>Confirmed</b></td><td>A Faculty Officer or assistant reviewer has reviewed and confirmed it. The student cannot edit it, and it is the only kind of paper counted as a &quot;pass&quot; in the statistics.</td></tr>
          <tr><td><b>Rejected</b></td><td>Sent back with a reason. The student must correct and resubmit (possible even after the round closes). It is not counted in the statistics until resubmitted and confirmed.</td></tr>
          <tr><td><b>Not yet signed in</b></td><td>An account that was imported but whose student has not yet signed in to complete the profile for the first time.</td></tr>
          <tr><td><b>Open for submission / Scheduled / Past closing date / Closed</b></td><td>The actual status of an exam round right now, worked out from the status the officer set together with the open–close dates (details in section 7.2).</td></tr>
        </tbody>
      </table>
    ),
  },
];
