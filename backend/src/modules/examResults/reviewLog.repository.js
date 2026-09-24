import prisma from "../../config/db.js";

// Insert-only — เก็บทุกครั้งที่ approve/reject ไม่ทับของเดิมเหมือน exam_results.confirmed_by
export const create = ({ result_id, reviewer_id, action, remark }) =>
  prisma.reviewLog.create({
    data: { result_id, reviewer_id, action, remark },
  });
