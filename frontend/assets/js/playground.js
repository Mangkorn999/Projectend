// Playground / Syntax Dissector logic (playground.js)

const templates = [
  {
    id: "js-async",
    label: "JavaScript: Async/Await & Fetch (ดึงข้อมูล API)",
    lang: "javascript",
    filename: "fetch-api.js",
    lines: [
      {
        code: "async function getUserData(userId) {",
        purpose: "ประกาศฟังก์ชันประมวลผลแบบอะซิงโครนัส (Asynchronous Function)",
        grammar: "คีย์เวิร์ด `async` นำหน้าฟังก์ชันระบุว่าฟังก์ชันนี้จะส่งกลับเป็นวัตถุ `Promise` เสมอ และอนุญาตให้ใช้คำสั่ง `await` ภายในตัวมันได้ เพื่อหยุดรอผลลัพธ์โดยไม่ขัดขวางการทำงานหลักของโปรแกรม",
        pitfall: "ลืมใส่คำสั่ง `async` นำหน้า แต่พยายามใช้ `await` ข้างในฟังก์ชัน จะส่งผลให้เกิดไวยากรณ์ผิดพลาดทันที (SyntaxError: await is only valid in async functions)"
      },
      {
        code: "    try {",
        purpose: "เริ่มต้นบล็อกตรวจสอบและดักจับข้อผิดพลาด (Exception Handling)",
        grammar: "คำสั่ง `try` จะครอบคลุมบล็อกคำสั่งที่มีโอกาสทำงานล้มเหลว (เช่น ดึงข้อมูลเครือข่ายล้มเหลว) เพื่อโยนข้อผิดพลาดไปให้บล็อก `catch` จัดการต่อ โดยป้องกันไม่ให้แอปพลิเคชันล่มทันที",
        pitfall: "การใช้บล็อก `try` จำเป็นต้องมีบล็อก `catch` หรือ `finally` ควบคู่กันเสมอ จะเขียน `try` เดี่ยวๆ ไม่ได้"
      },
      {
        code: "        const response = await fetch(`/api/users/${userId}`);",
        purpose: "ส่ง HTTP Request ไปยัง URL ปลายทางและรอรับการตอบกลับ",
        grammar: "คำสั่ง `await` จะหยุดการทำงานของบรรทัดนี้ชั่วคราวเพื่อรอให้ฟังก์ชัน `fetch` (ซึ่งส่งคืนค่าเป็น Promise) ทำงานจนเสร็จสิ้น จากนั้นเก็บผลลัพธ์ Response ไว้ในตัวแปรคงที่ `response` โดยใช้ Template Literal (เครื่องหมาย backtick `` ` ``) เพื่อแทรกตัวแปร `${userId}` เข้าไปในข้อความ",
        pitfall: "ลืมใส่ `await` นำหน้า `fetch` ส่งผลให้ตัวแปร `response` ได้รับค่าเป็นตัวแทนสัญญาที่ยังไม่เสร็จ (Promise Pending) แทนที่จะเป็นผลตอบรับจริง ทำให้เรียกใช้งานคุณสมบัติต่างๆ ในบรรทัดถัดไปล้มเหลว"
      },
      {
        code: "        if (!response.ok) {",
        purpose: "ตรวจสอบสถานะการตอบรับของฝั่งเซิร์ฟเวอร์",
        grammar: "คุณสมบัติ `response.ok` เป็นค่า Boolean ที่จะเป็นจริง (`true`) ก็ต่อเมื่อสถานะ HTTP status code อยู่ในระดับความสำเร็จ (ช่วง 200 - 299) เครื่องหมาย `!` (Logical NOT) ใช้เพื่อกลับค่าเช็คกรณีที่ส่งข้อมูลไม่สำเร็จ",
        pitfall: "เข้าใจผิดว่า `fetch` จะล้มเหลวและกระโดดไป `catch` ทันทีเมื่อเซิร์ฟเวอร์ส่ง Error 404 หรือ 500 กลับมา จริงๆ แล้ว `fetch` จะทำงานสำเร็จและเก็บ HTTP code เหล่านี้ไว้เสมอ มีเพียงปัญหาเชื่อมต่อเน็ตไม่ได้เท่านั้นที่จะเด้งไป `catch` ดังนั้นต้องเช็ค `.ok` ทุกครั้ง"
      },
      {
        code: "            throw new Error('ไม่พบข้อมูลผู้ใช้');",
        purpose: "โยนข้อผิดพลาด (Exception) ออกไปด้วยตนเอง",
        grammar: "คำสั่ง `throw` ใช้สำหรับขัดจังหวะการทำงานปัจจุบันและสร้างข้อผิดพลาดแบบกำหนดเองขึ้นมาโดยอ้างอิงวัตถุ `Error` ตัวระบบจะรีบข้ามไปทำงานในส่วนควบคุม `catch` ที่ใกล้ที่สุดทันที",
        pitfall: "เขียนคำสั่ง `throw` ผิดหรือไม่ได้ใส่ `new` นำหน้า `Error` แม้ว่าใน JS จะทำได้ แต่เป็นสไตล์ที่ไม่แนะนำ เพราะสูญเสียความสามารถในการวิเคราะห์ Stack Trace"
      },
      {
        code: "        }",
        purpose: "ปิดบล็อกเงื่อนไขการส่งข้อมูลไม่สำเร็จ",
        grammar: "สัญลักษณ์เครื่องหมายปีกกาปิด `}` แสดงขอบเขตการสิ้นสุดคำสั่งภายใต้เงื่อนไข `if` ก่อนหน้า",
        pitfall: "ลืมปิดปีกกาหรือใส่ปีกกาเกิน จะทำให้เครื่องมือคอมไพล์เดาโครงสร้างบล็อกผิดและเตือน Syntax Error ทันที"
      },
      {
        code: "        const data = await response.json();",
        purpose: "แปลงข้อมูลผลลัพธ์การตอบสนองที่ได้รับให้อยู่ในรูปของรูปแบบ JSON (JavaScript Object)",
        grammar: "เมธอด `.json()` เป็นระบบประมวลผลแบบ Asynchronous ที่ต้องใช้ `await` ควบคู่ด้วยเสมอ เพราะต้องรอดึงข้อความทั้งหมดจากสตรีมเครือข่ายก่อนจะนำมาจัดรูปแบบเป็นออบเจกต์",
        pitfall: "ลืมใส่ `await` หน้า `response.json()` ส่งผลให้ตัวแปร `data` ได้รับค่าเป็นตัวแทนสัญญา (Promise) แทนที่จะเป็นออบเจกต์ข้อมูลจริง ทำให้อ่านค่าคุณสมบัติต่างๆ ไม่ได้"
      },
      {
        code: "        return data;",
        purpose: "ส่งผลลัพธ์ข้อมูลที่แปลงแล้วกลับไปยังผู้เรียกฟังก์ชัน",
        grammar: "คำสั่ง `return` จะสิ้นสุดการทำงานภายในฟังก์ชันและส่งคืนค่าตัวแปร `data` ออกไปภายนอก",
        pitfall: "การเขียนคืนค่าภายในฟังก์ชันแบบ `async` ค่าจริงที่ส่งกลับออกไปจะถูกห่อหุ้มใน Promise เสมอ ผู้รับปลายทางต้องใช้ `await` หรือ `.then()` เพื่อแกะค่านั้นออกมาใช้อีกรอบ"
      },
      {
        code: "    } catch (error) {",
        purpose: "ดักจับข้อผิดพลาดที่เกิดขึ้นทั้งหมดภายในบล็อก try",
        grammar: "คีย์เวิร์ด `catch` จะทำงานอัตโนมัติเมื่อเกิดข้อผิดพลาดใดๆ ขึ้นในบล็อก `try` ด้านบน โดยส่งผ่านรายละเอียดของข้อผิดพลาดเข้ามาในพารามิเตอร์ชื่อ `error` เพื่อนำไปวิเคราะห์ต่อ",
        pitfall: "ละเลยการเขียนบล็อก `catch` จัดการระบบล้มเหลว อาจส่งผลให้เบราว์เซอร์แจ้งเตือนข้อผิดพลาดรุนแรงประเภท Unhandled Promise Rejection ส่งผลเสียต่อความเสถียรของแอปพลิเคชัน"
      },
      {
        code: "        console.error('เกิดข้อผิดพลาด:', error.message);",
        purpose: "บันทึกและแสดงข้อมูลความผิดพลาดออกทางคอนโซลสำหรับพัฒนา",
        grammar: "คำสั่ง `console.error` ใช้ส่งข้อมูลออกไปยัง Web Console ของนักพัฒนา โดยแสดงในรูปแบบแถบสีแดงเพื่อบ่งชี้ระดับแจ้งเตือน คุณสมบัติ `.message` ใช้แกะข้อความอธิบาย Error หลักออกมา",
        pitfall: "ส่งข้อความแสดงข้อผิดพลาดละเอียดเกินไป (เช่น System SQL Trace) กลับไปแสดงผลให้ลูกค้าเห็นในโหมดการทำงานปกติ (Production) ซึ่งเป็นช่องโหว่ความปลอดภัยหลัก"
      },
      {
        code: "    }",
        purpose: "ปิดบล็อกดักจับข้อผิดพลาด catch",
        grammar: "สัญลักษณ์สิ้นสุดขอบเขตคำสั่งจัดการข้อผิดพลาด",
        pitfall: "เช็คจำนวนวงเล็บปีกกาเปิด-ปิดเสมอว่าเท่ากันคู่กันในฟังก์ชันหรือไม่"
      },
      {
        code: "}",
        purpose: "สิ้นสุดการทำงานทั้งหมดของฟังก์ชัน getUserData",
        grammar: "ปีกกาปิดสุดท้ายของตัวฟังก์ชันหลัก",
        pitfall: "ระวังใส่ปีกกาปิดขาดหรือเกินเวลามีฟังก์ชันซ้อนฟังก์ชัน (Nested functions)"
      }
    ]
  },
  {
    id: "py-list-comp",
    label: "Python: List Comprehension (ตัวแปลงลิสต์แบบย่อ)",
    lang: "python",
    filename: "comp.py",
    lines: [
      {
        code: "numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
        purpose: "ประกาศลิสต์ข้อมูลตัวเลขจำนวนเต็มตั้งแต่ 1 ถึง 10",
        grammar: "ใน Python จะใช้เครื่องหมายวงเล็บเหลี่ยม `[]` ในการประกาศโครงสร้างข้อมูลประเภทลิสต์ (List) สมาชิกภายในแยกจากกันโดยใช้เครื่องหมายจุลภาค `,` ไม่จำเป็นต้องปิดบรรทัดด้วยเครื่องหมายเซมิโคลอน `;`",
        pitfall: "ลืมใส่เครื่องหมายวงเล็บเหลี่ยมเปิดหรือปิด หรือเขียนจุลภาคขาดหายไประหว่างข้อมูล"
      },
      {
        code: "even_squares = [x ** 2 for x in numbers if x % 2 == 0]",
        purpose: "แปลงและคัดกรองสมาชิกในลิสต์โดยเลือกเฉพาะเลขคู่มาคำนวณยกกำลังสองและสร้างลิสต์ใหม่",
        grammar: "ไวยากรณ์นี้เรียกว่า **List Comprehension** มีโครงสร้าง `[สูตร_แปลง_ผลลัพธ์ for สมาชิก in ลิสต์เดิม if เงื่อนไข_คัดกรอง]`. เครื่องหมาย `**` หมายถึงการยกกำลัง (ในที่นี้คือยกกำลัง 2) และตัวดำเนินการ `%` หมายถึงการหารเอาเศษ",
        pitfall: "เขียนสลับตำแหน่งลำดับคำสั่ง เช่น นำเงื่อนไข `if` ขึ้นก่อนลูป `for` (เขียนแบบนั้นจะใช้ในโครงสร้างแบบ Ternary Else เท่านั้น) ทำให้ Compiler แปลผลไม่ได้"
      },
      {
        code: "print(even_squares)  # ผลลัพธ์: [4, 16, 36, 64, 100]",
        purpose: "แสดงผลลัพธ์ลิสต์ใหม่ออกทางหน้าจอคอมพิวเตอร์",
        grammar: "ฟังก์ชัน `print()` ใช้แสดงข้อมูลออกทางหน้าจอหลัก สัญลักษณ์เครื่องหมายสี่เหลี่ยม `#` บ่งบอกว่าเป็นคอมเมนต์ (Comment) อธิบายโค้ดซึ่ง Python จะข้ามการประมวลผลบรรทัดนี้ไป",
        pitfall: "นำสัญลักษณ์คอมเมนต์ภาษาอื่นอย่าง `//` หรือ `/*` มาเขียนปนในภาษา Python ส่งผลให้โปรแกรมแจ้งเตือนไวยากรณ์ผิดพลาดทันที"
      }
    ]
  },
  {
    id: "c-pointers",
    label: "C: Pointer & Address (การสลับค่าโดยใช้พอยน์เตอร์)",
    lang: "c",
    filename: "swap.c",
    lines: [
      {
        code: "#include <stdio.h>",
        purpose: "นำเข้าไฟล์ส่วนหัวไลบรารีอินพุต-เอาต์พุตมาตรฐาน (Standard Input/Output)",
        grammar: "เครื่องหมาย `#` แสดงถึงคำสั่งเตรียมการประมวลผล (Preprocessor Directive) สั่งให้ระบบคัดลอกไลบรารี `stdio.h` เข้ามารวมไว้ในโค้ดก่อนเริ่มคอมไพล์ เพื่อให้เราใช้งานฟังก์ชันแสดงผลอย่าง `printf()` ได้",
        pitfall: "ลืมเขียนบรรทัดนี้ จะทำให้คอมไพเลอร์มองไม่เห็นฟังก์ชันอินพุตเอาต์พุตพื้นฐานของระบบและแจ้ง Error แจ้งเตือนเรื่องฟังก์ชันไม่ได้ประกาศล่วงหน้า"
      },
      {
        code: "void swap(int *a, int *b) {",
        purpose: "ประกาศฟังก์ชันไม่มีการส่งค่ากลับ (void) และรับพารามิเตอร์เป็นพอยน์เตอร์ตัวชี้ตำแหน่งหน่วยความจำ",
        grammar: "เครื่องหมาย `*` หน้าตัวแปรพารามิเตอร์ `*a` และ `*b` หมายความว่าพารามิเตอร์นี้ไม่ใช่ตัวแปรเก็บเลขธรรมดา แต่เป็นตัวชี้ (Pointer) ที่จะเก็บที่อยู่ในหน่วยความจำ (Memory Address) ของตัวแปรภายนอกอื่น",
        pitfall: "ไม่ได้ระบุชนิดข้อมูลพารามิเตอร์ให้ชัดเจน (เช่น เขียนแค่ `swap(a, b)`) ภาษา C จะไม่อนุญาตเด็ดขาดเพราะเป็น Static Typing"
      },
      {
        code: "    int temp = *a;",
        purpose: "นำค่าจริง ณ ที่อยู่ที่เก็บไว้ในพอยน์เตอร์ a มาเก็บไว้ในตัวแปรชั่วคราว temp",
        grammar: "เครื่องหมาย `*` ในบรรทัดนี้ทำหน้าที่เป็นตัวดำเนินการ Dereference Operator เพื่อเข้าไปอ่านหรือดึงค่าในกล่องที่พอยน์เตอร์ `a` ชี้อยู่จริงๆ มาถ่ายโอนเข้าตัวแปรตัวเลข `temp`",
        pitfall: "ลืมใส่เครื่องหมาย `*` หน้า `a` (เขียนว่า `int temp = a;`) คอมไพเลอร์จะขึ้นเตือนทันทีเพราะเรากำลังพยายามนำที่อยู่หน่วยความจำ (Address) ซึ่งเป็นประเภทตัวเลขขนาดใหญ่ ไปยัดใส่ตัวแปรจำนวนเต็ม (Integer) ตรงๆ"
      },
      {
        code: "    *a = *b;",
        purpose: "นำค่าในตำแหน่งที่อยู่ b ไปเก็บทับลงในตำแหน่งที่อยู่ a",
        grammar: "เป็นการเข้าถึงที่อยู่ทางอ้อม ดึงค่าข้างในหน่วยความจำของ `b` (`*b`) แล้วนำไปเขียนทับลงในที่อยู่ปลายทางที่ `a` ชี้ไป",
        pitfall: "เขียนสลับฝั่งซ้ายขวาทำให้การสลับตำแหน่งสลับผิดทิศทาง"
      },
      {
        code: "    *b = temp;",
        purpose: "นำค่าในตัวแปรสำรอง temp ไปเก็บลงในที่อยู่หน่วยความจำของ b เพื่อเสร็จสิ้นกระบวนการสลับค่า",
        grammar: "ดึงค่าจากตัวสำรอง `temp` นำกลับไปบันทึกลงในหน่วยความจำจริงที่พอยน์เตอร์ `b` คุมขอบเขตอยู่",
        pitfall: "ลืมปิดท้ายคำสั่งด้วยเซมิโคลอน `;` เป็นหนึ่งในความผิดพลาดที่ยอดนิยมที่สุดในการเขียนภาษาตระกูล C"
      },
      {
        code: "}",
        purpose: "สิ้นสุดฟังก์ชันสลับค่า swap",
        grammar: "เครื่องหมายปีกกาปิดบล็อกฟังก์ชัน",
        pitfall: "เช็คขอบเขตบล็อกเสมอ"
      }
    ]
  },
  {
    id: "java-oop",
    label: "Java: OOP Inheritance (คลาสและการสืบทอดคุณสมบัติ)",
    lang: "java",
    filename: "Inheritance.java",
    lines: [
      {
        code: "public class Dog extends Animal {",
        purpose: "ประกาศคลาสใหม่ชื่อ Dog โดยมีคุณสมบัติสืบทอดมาจากคลาสแม่ชื่อ Animal",
        grammar: "คีย์เวิร์ด `extends` ใช้สำหรับการสืบทอดคุณสมบัติ (Inheritance) ในภาษา Java ทำให้คลาสลูก (Dog) ได้รับเมธอดและฟิลด์ข้อมูลทั้งหมดมาจากคลาสแม่ (Animal) โดยไม่ต้องเขียนโค้ดซ้ำ",
        pitfall: "พยายามใช้การสืบทอดข้ามคลาสแม่หลายๆ ตัวพร้อมกัน (เช่น `extends Animal, Mammal`) Java ห้ามทำสืบทอดซ้อนกันหลายตัวแปรเด็ดขาด (Single Inheritance เท่านั้น)"
      },
      {
        code: "    public Dog(String name) {",
        purpose: "นิยามคอนสตรัคเตอร์ (Constructor) เพื่อกำหนดค่าเริ่มต้นเวลาสร้างออบเจกต์",
        grammar: "คอนสตรัคเตอร์ต้องมีชื่อเหมือนชื่อคลาสทุกประการ (ในที่นี้คือ `Dog`) และจะทำงานโดยอัตโนมัติทันทีที่มีการใช้คีย์เวิร์ด `new` เพื่อสร้างออบเจกต์สุนัข",
        pitfall: "เผลอใส่ชนิดข้อมูลการคืนค่า เช่น `public void Dog(...)` จะทำให้ Java คิดว่าเป็นเมธอดทั่วไปแทนที่จะเป็นคอนสตรัคเตอร์ ส่งผลให้ตอนสร้างออบเจกต์ระบบเรียกใช้งานไม่ได้"
      },
      {
        code: "        super(name);",
        purpose: "เรียกใช้คอนสตรัคเตอร์ของคลาสแม่ (Animal)",
        grammar: "เมธอด `super()` ทำหน้าที่ส่งผ่านพารามิเตอร์ขึ้นไปให้คอนสตรัคเตอร์คลาสแม่ทำงานก่อน เพื่อตั้งค่าเริ่มต้นที่จำเป็นในระบบหลักของวัตถุ",
        pitfall: "เขียนคำสั่ง `super()` ไว้ในบรรทัดอื่นที่ไม่ใช่บรรทัดแรกของคอนสตรัคเตอร์ Java กำหนดกฎเข้มงวดว่าต้องเรียกใช้งานคลาสแม่เป็นอันดับแรกสุดเสมอ (Must be first statement)"
      },
      {
        code: "    }",
        purpose: "สิ้นสุดส่วนประกาศตัวคอนสตรัคเตอร์",
        grammar: "ปีกกาปิดขอบเขตตัวควบคุมของคอนสตรัคเตอร์",
        pitfall: "ตรวจสอบการเยื้องโค้ดให้อ่านง่ายเสมอ"
      },
      {
        code: "    @Override",
        purpose: "สัญลักษณ์แจ้งเตือนคอมไพเลอร์ว่าเรากำลังเขียนเมธอดทับตัวแปรคลาสแม่ (Polymorphism)",
        grammar: "สัญลักษณ์การระบุ `@Override` เป็น Annotation ที่บอกคอมไพเลอร์ให้ช่วยตรวจสอบความถูกต้องว่ามีเมธอดที่มีชื่อและรูปแบบอาร์กิวเมนต์เหมือนกันนี้อยู่ในคลาสแม่จริงๆ หรือไม่ เพื่อป้องกันการพิมพ์ตัวสะกดผิด",
        pitfall: "สะกดชื่อเมธอดในคลาสลูกผิดเพี้ยนไปจากคลาสแม่แต่ยังใส่ `@Override` คอมไพเลอร์จะฟ้อง Error ตรวจสอบไม่ผ่านทันที"
      },
      {
        code: "    public void makeSound() {",
        purpose: "นิยามเมธอดส่งเสียงเฉพาะสำหรับสุนัข",
        grammar: "คีย์เวิร์ด `public` อนุญาตให้ส่วนงานอื่นๆ ภายนอกคลาสเข้ามาเรียกใช้งานเมธอดนี้ได้ ส่วน `void` แสดงว่าไม่มีข้อมูลผลลัพธ์ส่งกลับ",
        pitfall: "ลืมประกาศเป็น `public` ในคลาสลูกแต่ในคลาสแม่เป็น `public` จะเกิด Error ลดทอนสิทธิ์ในการเข้าถึง (Cannot reduce visibility)"
      },
      {
        code: "        System.out.println(\"โฮ่ง โฮ่ง!\");",
        purpose: "แสดงข้อความผลเสียงสุนัขออกทางหน้าจอ",
        grammar: "คำสั่งแสดงผลมาตรฐานของ Java โดยระบุ Class ระบบหลัก `System` ดึงสตรีมเอาต์พุต `out` และส่งผ่านข้อมูลลงบรรทัดใหม่ด้วย `println()`",
        pitfall: "สะกดสัญลักษณ์คลาสขึ้นต้นผิดเพี้ยน เช่น เขียน `system.out` (ตัวพิมพ์เล็ก) ส่งผลให้ Compile ไม่ผ่านเพราะภาษา Java จำแนกพิมพ์ใหญ่พิมพ์เล็กต่างกัน (Case-sensitive)"
      },
      {
        code: "    }",
        purpose: "ปิดเมธอดส่งเสียง",
        grammar: "ปีกกาปิดขอบเขตการทำงานภายในของเมธอด",
        pitfall: "ตรวจสมดุลปีกกาเปิด-ปิด"
      },
      {
        code: "}",
        purpose: "สิ้นสุดตัวคลาส Dog ทั้งหมด",
        grammar: "ปีกกาปิดใหญ่สุดที่เป็นการคุมขอบเขตของคลาสลูก",
        pitfall: "หากขาดปีกกาปิดของตัวคลาส จะทำให้คอมไพเลอร์สับสนในการอ่านจบโครงสร้างไฟล์"
      }
    ]
  }
];

let activeTemplateId = "js-async";
let selectedLineIdx = null;
let readLines = {}; // Keeps track of lines clicked for each template

document.addEventListener("DOMContentLoaded", () => {
  initTemplateSelector();
  loadTemplate(activeTemplateId);

  const select = document.getElementById("template-select");
  select.addEventListener("change", (e) => {
    loadTemplate(e.target.value);
  });
});

// Load templates lists inside select option dropdown
function initTemplateSelector() {
  const select = document.getElementById("template-select");
  if (!select) return;

  select.innerHTML = "";
  templates.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.label;
    select.appendChild(opt);
  });
}

// Load chosen template data
function loadTemplate(templateId) {
  activeTemplateId = templateId;
  selectedLineIdx = null;
  
  // Initialize read progress if not yet tracked
  if (!readLines[templateId]) {
    readLines[templateId] = new Set();
  }

  const template = templates.find(t => t.id === templateId);
  if (!template) return;

  // Set file badge name
  document.getElementById("editor-lang-badge").textContent = template.filename;

  // Render clickable lines code editor
  renderClickableCode(template);

  // Reset details panels
  resetExplainerPanel();

  // Update line counts
  updateProgressStats(template);
}

// Generate code lines inside editor with index
function renderClickableCode(template) {
  const container = document.getElementById("clickable-code-editor");
  if (!container) return;

  container.innerHTML = "";
  template.lines.forEach((lineData, idx) => {
    const lineDiv = document.createElement("div");
    lineDiv.className = "line-item px-3 py-1.5 rounded-lg font-mono text-xs sm:text-sm cursor-pointer hover:bg-slate-800/40 border border-transparent transition-all flex gap-4 select-none";
    lineDiv.id = `dissect-line-${idx}`;
    
    // Check if line was previously read/clicked
    const isRead = readLines[activeTemplateId].has(idx);
    
    lineDiv.innerHTML = `
      <span class="text-slate-650 w-6 text-right select-none font-semibold font-mono">${idx + 1}</span>
      <span class="flex-1 whitespace-pre leading-relaxed text-slate-350">${escapeHTML(lineData.code)}</span>
      <span class="read-indicator text-[10px] text-emerald-500 font-semibold opacity-70 select-none w-4">${isRead ? '✓' : ''}</span>
    `;

    // Click behavior
    lineDiv.addEventListener("click", () => {
      selectLine(idx, template);
    });

    container.appendChild(lineDiv);
  });
}

// Handle line selection and explainers display
function selectLine(idx, template) {
  selectedLineIdx = idx;
  
  // Highlight active visual line element
  const items = document.querySelectorAll(".line-item");
  items.forEach(item => {
    item.classList.remove("bg-indigo-600/25", "border-indigo-500/30", "scale-[1.01]", "shadow-sm");
  });

  const activeLine = document.getElementById(`dissect-line-${idx}`);
  if (activeLine) {
    activeLine.classList.add("bg-indigo-600/25", "border-indigo-500/30", "scale-[1.01]", "shadow-sm");
    
    // Add checkmark indicating read
    const indicator = activeLine.querySelector(".read-indicator");
    if (indicator) indicator.textContent = "✓";
  }

  // Display detail panel
  const emptyState = document.getElementById("explainer-empty-state");
  const detailContent = document.getElementById("explainer-detail-content");
  const activeLineCounter = document.getElementById("active-line-counter");

  if (emptyState && detailContent) {
    emptyState.classList.add("hidden");
    detailContent.classList.remove("hidden");
  }

  activeLineCounter.textContent = `วิเคราะห์บรรทัดที่ ${idx + 1} จากทั้งหมด ${template.lines.length} บรรทัด`;

  const lineData = template.lines[idx];
  document.getElementById("line-purpose").textContent = lineData.purpose;
  document.getElementById("line-grammar").textContent = lineData.grammar;
  document.getElementById("line-pitfall").textContent = lineData.pitfall;

  // Track progress
  const hasFirstRead = !readLines[activeTemplateId].has(idx);
  readLines[activeTemplateId].add(idx);
  
  // Award 5 XP on each new line dissect read to motivate learning!
  if (hasFirstRead) {
    window.addXP(5);
  }

  updateProgressStats(template);
}

function resetExplainerPanel() {
  const emptyState = document.getElementById("explainer-empty-state");
  const detailContent = document.getElementById("explainer-detail-content");
  const activeLineCounter = document.getElementById("active-line-counter");

  if (emptyState && detailContent) {
    emptyState.classList.remove("hidden");
    detailContent.classList.add("hidden");
  }
  
  if (activeLineCounter) {
    activeLineCounter.textContent = "เลือกบรรทัดในฝั่งซ้ายก่อนเริ่มเรียนรู้";
  }
}

// Update read counts and completion badge
function updateProgressStats(template) {
  const readCount = readLines[activeTemplateId].size;
  const totalCount = template.lines.length;

  document.getElementById("lines-read-count").textContent = `${readCount}/${totalCount}`;

  const completionStatus = document.getElementById("read-completion-status");
  if (readCount === totalCount) {
    completionStatus.classList.remove("hidden");
    
    // Award 40 bonus XP for completing a template!
    const bonusKey = `syntaxcraft_sandbox_bonus_${activeTemplateId}`;
    if (!localStorage.getItem(bonusKey)) {
      localStorage.setItem(bonusKey, "true");
      window.addXP(40);
    }
  } else {
    completionStatus.classList.add("hidden");
  }
}

function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
