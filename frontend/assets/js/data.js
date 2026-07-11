// Code and Syntax Comparison Database for 5 Languages
const syntaxData = [
  {
    id: "variables",
    title: "📦 Variables (การประกาศตัวแปร)",
    desc: "ตัวแปรเปรียบเสมือนกล่องสำหรับเก็บข้อมูลในหน่วยความจำ ซึ่งแต่ละภาษาจะมีวิธีการประกาศและข้อกำหนดที่แตกต่างกันอย่างสิ้นเชิง เช่น ภาษาที่ต้องระบุชนิดข้อมูล (Static Typing) และภาษาที่ไม่ต้องระบุ (Dynamic Typing)",
    languages: {
      js: {
        title: "JavaScript",
        code: `// 1. let: ใช้สำหรับตัวแปรที่ต้องการเปลี่ยนค่าได้
let score = 100;
score = 150; // สำเร็จ!

// 2. const: ใช้สำหรับค่าคงที่ เปลี่ยนค่าไม่ได้
const PI = 3.14159;
// PI = 3.14; // เกิด Error!

// 3. var: วิธีดั้งเดิม (ไม่แนะนำให้ใช้ในปัจจุบัน)
var name = "Alex"; // ขอบเขตเป็น Function-scoped`,
        explanation: "JavaScript เป็นภาษาแบบ **Dynamic Typing** ไม่ต้องประกาศชนิดข้อมูล (เช่น int, string) ตัวแปรที่ใช้ `let` จะมีขอบเขตแบบ Block-scoped `{}` ซึ่งปลอดภัยกว่า `var` ในขณะที่ `const` ใช้ประกาศค่าคงที่ที่ไม่สามารถกำหนดค่าใหม่ได้ (Reassign)"
      },
      py: {
        title: "Python",
        code: `# 1. ตัวแปรทั่วไป: ไม่ต้องใช้คีย์เวิร์ดนำหน้า
score = 100
score = 150 # เปลี่ยนค่าได้ตามปกติ

# 2. ค่าคงที่: Python ไม่มีตัวแปรคงที่ (Constant) แท้จริง
# นิยมเขียนด้วยตัวพิมพ์ใหญ่ทั้งหมดเพื่อบอกว่าเป็นค่าคงที่
PI = 3.14159

# 3. กำหนดค่าพร้อมกันหลายตัวแปร
x, y, z = 10, 20, 30`,
        explanation: "Python เป็นภาษาแบบ **Dynamic & Strongly Typed** ไม่ต้องระบุชนิดตัวแปรและห้ามผสมชนิดข้อมูลโดยไม่แปลงค่าก่อน เช่น `'Score: ' + 100` จะเกิด Error ทันที (ต้องแปลงเป็น `str(100)` ก่อน) และจะเว้นช่องว่าง (Indentation) ในการแบ่งบล็อก"
      },
      java: {
        title: "Java",
        code: `// Java เป็น Static Typing ต้องระบุชนิดข้อมูลเสมอ
int score = 100;
score = 150; // เปลี่ยนค่าได้

// การประกาศค่าคงที่ใช้คีย์เวิร์ด 'final'
final double PI = 3.14159;
// PI = 3.14; // Compile Error!

String name = "Alex"; // String ต้องขึ้นต้นด้วยตัวใหญ่`,
        explanation: "Java เป็นภาษาแบบ **Static Typing** และ **Strongly Typed** จำเป็นต้องระบุประเภทตัวแปรอย่างชัดเจน เช่น `int`, `double`, `String` และจะตรวจสอบประเภทข้อมูลตอนเขียนโค้ด (Compile-time) ป้องกันข้อผิดพลาดได้ดีมาก"
      },
      c: {
        title: "C",
        code: `// C เป็นภาษาดั้งเดิม ต้องระบุชนิดข้อมูลชัดเจน
int score = 100;
score = 150;

// ค่าคงที่ใช้ 'const' หรือ '#define'
const double PI = 3.14159;

// ข้อความในภาษา C คือ Array ของ char (จบด้วย '\\0')
char name[] = "Alex"; 
char first_letter = 'A'; // char เดี่ยวใช้ single quote`,
        explanation: "C เป็นภาษาแบบ **Low-level & Static Typing** ไม่มีตัวแปรชนิดข้อความ (String) โดยตรง ต้องใช้ Array ของตัวอักษร (`char[]`) และเป็นรากฐานของภาษาอย่าง Java, C++ และ C#"
      },
      csharp: {
        title: "C#",
        code: `// 1. ระบุชนิดข้อมูลอย่างชัดเจน
int score = 100;
score = 150;

// 2. ใช้ 'const' สำหรับค่าคงที่
const double PI = 3.14159;

// 3. ใช้ 'var' ให้ Compiler เดาชนิดข้อมูลให้ (ยังคงเป็น Static Typing)
var name = "Alex"; // Compiler จะระบุอัตโนมัติว่าเป็น string`,
        explanation: "C# พัฒนาโดย Microsoft เพื่อรวบรวมข้อดีของ C++ และ Java มีคีย์เวิร์ด `var` ที่ช่วยให้เขียนง่ายขึ้นโดยที่ยังคงความเป็น Static Typing อยู่ (ระบุชนิดข้อมูลตอน compile อัตโนมัติ)"
      }
    }
  },
  {
    id: "conditionals",
    title: "❓ Conditionals (เงื่อนไขและทางเลือก)",
    desc: "การควบคุมทิศทางของโปรแกรมโดยใช้เงื่อนไขตรวจสอบ (If-Else / Switch) เพื่อให้โปรแกรมตัดสินใจเลือกทำงานตามเงื่อนไขที่กำหนด",
    languages: {
      js: {
        title: "JavaScript",
        code: `let x = 10;
if (x > 15) {
    console.log("x มากกว่า 15");
} else if (x > 5) {
    console.log("x มากกว่า 5 แต่ไม่เกิน 15");
} else {
    console.log("x น้อยกว่าหรือเท่ากับ 5");
}

// Ternary Operator (เงื่อนไขย่อ)
let result = (x >= 10) ? "ผ่าน" : "ไม่ผ่าน";`,
        explanation: "JavaScript ใช้โครงสร้างมาตรฐาน วงเล็บ `()` ครอบเงื่อนไข และใช้ `{}` ครอบบล็อกคำสั่ง และมี Ternary Operator (`เงื่อนไข ? ค่าถ้าจริง : ค่าถ้าเท็จ`) สำหรับการเขียนเงื่อนไขสั้นๆ บรรทัดเดียว"
      },
      py: {
        title: "Python",
        code: `x = 10
if x > 15:
    print("x มากกว่า 15")
elif x > 5:
    print("x มากกว่า 5 แต่ไม่เกิน 15")
else:
    print("x น้อยกว่าหรือเท่ากับ 5")

# Ternary Operator ใน Python
result = "ผ่าน" if x >= 10 else "ไม่ผ่าน"`,
        explanation: "Python โดดเด่นเรื่องความสะอาดของโค้ด **ไม่ใช้** วงเล็บครอบเงื่อนไขและไม่ใช้ `{}` แต่ใช้เครื่องหมายโคลอน `:` และการ **ย่อหน้า (Indentation)** 4 spaces เป็นตัวกำหนดบล็อกคำสั่ง คีย์เวิร์ดของ Else If คือ `elif`"
      },
      java: {
        title: "Java",
        code: `int x = 10;
if (x > 15) {
    System.out.println("x มากกว่า 15");
} else if (x > 5) {
    System.out.println("x มากกว่า 5 แต่ไม่เกิน 15");
} else {
    System.out.println("x น้อยกว่าหรือเท่ากับ 5");
}

// Ternary
String result = (x >= 10) ? "ผ่าน" : "ไม่ผ่าน";`,
        explanation: "โครงสร้างเหมือน JavaScript ทุกประการ แต่การแสดงผลต้องใช้คำสั่งยาวขึ้นคือ `System.out.println()` และทุกคำสั่งต้องลงท้ายด้วยเซมิโคลอน `;` เสมอ"
      },
      c: {
        title: "C",
        code: `#include <stdio.h>
int x = 10;
if (x > 15) {
    printf("x มากกว่า 15\\n");
} else if (x > 5) {
    printf("x มากกว่า 5 แต่ไม่เกิน 15\\n");
} else {
    printf("x น้อยกว่าหรือเท่ากับ 5\\n");
}

// Ternary
char* result = (x >= 10) ? "ผ่าน" : "ไม่ผ่าน";`,
        explanation: "โครงสร้างแบบดั้งเดิมที่ภาษาอื่นเอาเป็นแบบอย่าง การแสดงผลใช้ `printf()` และใช้รหัสควบคุมอย่าง `\\n` เพื่อขึ้นบรรทัดใหม่"
      },
      csharp: {
        title: "C#",
        code: `int x = 10;
if (x > 15) {
    Console.WriteLine("x มากกว่า 15");
} else if (x > 5) {
    Console.WriteLine("x มากกว่า 5 แต่ไม่เกิน 15");
} else {
    Console.WriteLine("x น้อยกว่าหรือเท่ากับ 5");
}

// Ternary
string result = (x >= 10) ? "ผ่าน" : "ไม่ผ่าน";`,
        explanation: "โครงสร้างถอดแบบมาจาก C และ Java ใช้ `Console.WriteLine()` ในการแสดงผลออกทางหน้าจอคอนโซล"
      }
    }
  },
  {
    id: "loops",
    title: "🔁 Loops (การทำงานซ้ำ)",
    desc: "การสั่งให้โค้ดทำงานวนซ้ำๆ จนกว่าจะครบรอบหรือตรงตามเงื่อนไขที่กำหนด ช่วยลดความซ้ำซ้อนของการเขียนโค้ดเดิมซ้ำๆ",
    languages: {
      js: {
        title: "JavaScript",
        code: `// For loop แบบมาตรฐาน
for (let i = 0; i < 5; i++) {
    console.log(i); // 0, 1, 2, 3, 4
}

// วนลูปอาเรย์ (For...of)
const items = ["A", "B", "C"];
for (let item of items) {
    console.log(item);
}

// While loop
let count = 0;
while (count < 3) {
    console.log(count);
    count++;
}`,
        explanation: "JS มี `for` ลูปแบบคลาสสิกที่ประกอบด้วย (ค่าเริ่มต้น; เงื่อนไขจบ; การเปลี่ยนค่า) และยังมี `for...of` สำหรับวนลูปเอาค่าในอาเรย์มาใช้โดยตรง"
      },
      py: {
        title: "Python",
        code: `# วนลูปตามจำนวนรอบด้วย range(start, end_exclusive)
for i in range(0, 5):
    print(i) # 0, 1, 2, 3, 4

# วนลูปในลิสต์โดยตรง
items = ["A", "B", "C"]
for item in items:
    print(item)

# While loop
count = 0
while count < 3:
    print(count)
    count += 1 # Python ไม่มี count++`,
        explanation: "Python ใช้ `for in` ร่วมกับฟังก์ชัน `range()` ในการทำลูปตามรอบ และใช้ `for item in list:` สำหรับการลูปข้อมูลใน List สังเกตว่าใน Python ไม่มีคำสั่งเพิ่มค่าแบบสั้นอย่าง `count++` ต้องใช้ `count += 1` เท่านั้น"
      },
      java: {
        title: "Java",
        code: `// For loop มาตรฐาน
for (int i = 0; i < 5; i++) {
    System.out.println(i);
}

// Enhanced For-Loop (สำหรับ Array/List)
String[] items = {"A", "B", "C"};
for (String item : items) {
    System.out.println(item);
}

// While loop
int count = 0;
while (count < 3) {
    System.out.println(count);
    count++;
}`,
        explanation: "Java โครงสร้างคลาสสิกเหมือน C และ JS สำหรับการวนลูปอาเรย์จะใช้โครงสร้าง `for (Type variable : array)` ซึ่งเรียกว่า Enhanced For loop"
      },
      c: {
        title: "C",
        code: `// C ลูปมาตรฐาน
int i;
for (i = 0; i < 5; i++) {
    printf("%d\\n", i);
}

// วนลูป Array ในภาษา C ต้องระบุขนาดด้วยตัวเอง
char items[] = {'A', 'B', 'C'};
int length = sizeof(items) / sizeof(items[0]);
for (int j = 0; j < length; j++) {
    printf("%c\\n", items[j]);
}

// While loop
int count = 0;
while (count < 3) {
    printf("%d\\n", count);
    count++;
}`,
        explanation: "ในมาตรฐาน C เก่า (C89) ต้องประกาศตัวแปรลูป `int i;` นอกวงเล็บก่อน และการลูป Array ไม่มีคุณสมบัติ `.length` อัตโนมัติ ต้องคำนวณขนาดหน่วยความจำเองโดยใช้ `sizeof()`"
      },
      csharp: {
        title: "C#",
        code: `// For loop มาตรฐาน
for (int i = 0; i < 5; i++) {
    Console.WriteLine(i);
}

// Foreach loop (คล้าย Java/JS)
string[] items = {"A", "B", "C"};
foreach (string item in items) {
    Console.WriteLine(item);
}

// While loop
int count = 0;
while (count < 3) {
    Console.WriteLine(count);
    count++;
}`,
        explanation: "C# ใช้คำสั่ง `foreach (type item in collection)` สำหรับวนลูปข้อมูลในอาเรย์หรือคอลเลกชัน ซึ่งอ่านง่ายและปลอดภัยจากปัญหา Index Out of Range"
      }
    }
  },
  {
    id: "functions",
    title: "⚙️ Functions (ฟังก์ชัน/เมธอด)",
    desc: "บล็อกของโค้ดที่รวมคำสั่งทำงานอย่างใดอย่างหนึ่งไว้ด้วยกัน สามารถเรียกใช้งานซ้ำๆ และส่งผ่านข้อมูล (Parameters) รวมถึงส่งค่ากลับ (Return values) ได้",
    languages: {
      js: {
        title: "JavaScript",
        code: `// 1. ประกาศแบบดั้งเดิม
function greet(name) {
    return "สวัสดี " + name;
}

// 2. ประกาศแบบ Arrow Function (ES6) - สั้นกระชับ
const add = (a, b) => a + b;

// 3. ฟังก์ชันที่มีค่าดีฟอลต์ (Default Parameter)
function welcome(user = "Guest") {
    return "ยินดีต้อนรับ " + user;
}

console.log(greet("เอล็กซ์")); // สวัสดี เอล็กซ์
console.log(add(5, 10));     // 15`,
        explanation: "JavaScript มีความยืดหยุ่นมาก สามารถเก็บฟังก์ชันไว้ในตัวแปร ส่งฟังก์ชันเป็นอาร์กิวเมนต์ให้กับฟังก์ชันอื่นได้ (First-class functions) และมีสัญลักษณ์ลัดลูกศร `=>` (Arrow Function)"
      },
      py: {
        title: "Python",
        code: `# ใช้คีย์เวิร์ด 'def' ในการนิยามฟังก์ชัน
def greet(name):
    return f"สวัสดี {name}"

# ฟังก์ชันบรรทัดเดียว (Lambda Expression)
add = lambda a, b: a + b

# ฟังก์ชันมีค่าเริ่มต้น
def welcome(user="Guest"):
    return f"ยินดีต้อนรับ {user}"

print(greet("เอล็กซ์"))
print(add(5, 10))`,
        explanation: "Python นิยามฟังก์ชันด้วย `def` และใช้สัญกรณ์ `f\"... {variable} ...\"` (f-string) ในการแทรกตัวแปรลงในข้อความอย่างสวยงาม และมี `lambda` สำหรับฟังก์ชันนิรนามขนาดเล็ก"
      },
      java: {
        title: "Java",
        code: `public class Main {
    // ฟังก์ชันใน Java ต้องอยู่ภายใต้ Class และถูกเรียกว่า Method
    // ต้องระบุชนิดข้อมูลที่จะส่งกลับ (เช่น String, int) หรือ void ถ้าไม่มีการส่งกลับ
    public static String greet(String name) {
        return "สวัสดี " + name;
    }

    public static int add(int a, int b) {
        return a + b;
    }

    public static void main(String[] args) {
        System.out.println(greet("เอล็กซ์"));
        System.out.println(add(5, 10));
    }
}`,
        explanation: "Java บังคับโครงสร้าง OOP เต็มรูปแบบ เมธอดทุกตัวต้องอยู่ใน Class และต้องเขียนประกาศ Modifier เข้าถึง (เช่น `public`), คุณสมบัติของเมธอด (เช่น `static` หมายถึงไม่ต้องสร้างออบเจกต์ก็เรียกใช้ได้) และประเภทผลลัพธ์ที่จะคืนค่าออกไป"
      },
      c: {
        title: "C",
        code: `#include <stdio.h>

// ต้องระบุประเภทผลลัพธ์ และชนิดของ Parameter ชัดเจน
int add(int a, int b) {
    return a + b;
}

// ฟังก์ชันที่ไม่ส่งค่ากลับใช้ 'void'
void greet(char name[]) {
    printf("สวัสดี %s\\n", name);
}

int main() {
    greet("เอล็กซ์");
    int sum = add(5, 10);
    printf("ผลรวม: %d\\n", sum);
    return 0;
}`,
        explanation: "ภาษา C ต้องสร้างฟังก์ชันหลักชื่อ `main()` เพื่อเป็นจุดเริ่มต้นในการทำงานของระบบ และหากฟังก์ชันถูกใช้งานก่อนที่จะถูกเขียนไว้ข้างบน ต้องทำการประกาศหัวฟังก์ชัน (Prototype) ไว้ตอนต้นไฟล์ก่อนเสมอ"
      },
      csharp: {
        title: "C#",
        code: `using System;

class Program {
    // โครงสร้างคล้าย Java
    public static string Greet(string name) {
        return $"สวัสดี {name}";
    }

    public static int Add(int a, int b) {
        return a + b;
    }

    static void Main(string[] args) {
        Console.WriteLine(Greet("เอล็กซ์"));
        Console.WriteLine(Add(5, 10));
    }
}`,
        explanation: "C# มีกฎข้อกำหนดคล้ายกับ Java โดยเมธอดต้องขึ้นด้วยตัวพิมพ์ใหญ่ตัวแรก (PascalCase) ตามมาตรฐานการเขียนภาษา C# (เช่น `Greet` แทนที่จะเป็น `greet` ใน Java)"
      }
    }
  },
  {
    id: "arrays",
    title: "📋 Arrays & Lists (โครงสร้างข้อมูลชุด)",
    desc: "การเก็บข้อมูลชุดเดียวกันไว้ร่วมกันในตัวแปรเดียว เพื่อให้จัดการข้อมูลปริมาณมากผ่านดัชนี (Index) ค้นหา หรือประมวลผลข้อมูลในคราวเดียวได้ง่าย",
    languages: {
      js: {
        title: "JavaScript",
        code: `// ประกาศ Array ขนาดไม่คงที่ ใส่ข้อมูลผสมชนิดกันได้
let fruits = ["Apple", "Banana", 42];

// การเข้าถึงดัชนี (เริ่มจาก 0)
console.log(fruits[0]); // "Apple"

// เพิ่มข้อมูลต่อท้าย
fruits.push("Orange");

// ฟังก์ชันระดับสูงยอดนิยม
let numbers = [1, 2, 3, 4];
let doubled = numbers.map(x => x * 2); // [2, 4, 6, 8]`,
        explanation: "ใน JS ตัว Array ทำงานเปรียบเสมือน Dynamic List ขยายขนาดอัตโนมัติ และมีฟังก์ชันจัดการอาร์เรย์ที่ทรงพลังอย่าง `.map()`, `.filter()`, `.reduce()` ซึ่งเป็นหัวใจสำคัญของการเขียนสไตล์ Functional Programming"
      },
      py: {
        title: "Python",
        code: `# ใน Python จะเรียกว่า 'List' ขยายขนาดและผสมประเภทข้อมูลได้
fruits = ["Apple", "Banana", 42]

# เข้าถึงข้อมูล ดัชนีติดลบหมายถึงนับจากท้ายสุด
print(fruits[-1]) # 42 (ตัวสุดท้าย)

# เพิ่มข้อมูลต่อท้าย
fruits.append("Orange")

# เทคนิค List Comprehension (การแปลงข้อมูลในลิสต์แบบสั้น)
numbers = [1, 2, 3, 4]
doubled = [x * 2 for x in numbers] # [2, 4, 6, 8]`,
        explanation: "Python เรียกโครงสร้างอาเรย์ขยายได้นี้ว่า **List** มีความสามารถเจ๋งๆ อย่างลบหรือหั่นข้อมูลด้วย Slicing เช่น `fruits[0:2]` และความยืดหยุ่นสูงมากโดยมี syntax ย่ออย่าง List Comprehension"
      },
      java: {
        title: "Java",
        code: `// Array แบบมาตรฐาน: ขนาดคงที่ เปลี่ยนไม่ได้หลังสร้าง
String[] staticArray = new String[3];
staticArray[0] = "Apple";

// ArrayList: อาเรย์ยืดหยุ่นขยายขนาดได้
import java.util.ArrayList;
ArrayList<String> fruits = new ArrayList<>();
fruits.add("Apple");
fruits.add("Banana");

// การเข้าถึง
System.out.println(fruits.get(0)); // "Apple"`,
        explanation: "Java แยกชัดเจนระหว่าง **Array มาตรฐาน** (ขนาดคงที่ เพิ่มลดความยาวไม่ได้) กับ **ArrayList** ซึ่งเป็นคลาสยืดหยุ่นที่ขยายขนาดได้อัตโนมัติ และเก็บข้อมูลเฉพาะชนิดที่กำหนดเท่านั้น (Generic type)"
      },
      c: {
        title: "C",
        code: `#include <stdio.h>

int main() {
    // Array ขนาดคงที่ จำเป็นต้องระบุขนาดหรือสมาชิกเริ่มต้น
    int numbers[5] = {1, 2, 3, 4, 5};
    
    // เข้าถึงข้อมูล
    printf("ตัวแรก: %d\\n", numbers[0]);
    
    // ห้ามเขียนเพิ่มขอบเขตของ Array (ไม่มีกลไกขยายขนาดอัตโนมัติ)
    // numbers[5] = 10; // ❌ ปัญหา Buffer Overflow / เกิดข้อผิดพลาดของระบบ
    
    return 0;
}`,
        explanation: "Array ในภาษา C เป็นแบบ **Static Memory Allocation** ขนาดต้องรู้ล่วงหน้าตอนรันโปรแกรม ตัวแปรกักเก็บข้อมูลอยู่ติดกันในเมมโมรี่ และ C ไม่มีระบบเช็คว่าเข้าถึงเกินขอบเขตหรือไม่ ถือเป็นจุดสำคัญที่ต้องระวังเพราะอาจทำให้ระบบแครชหรือช่องโหว่ความปลอดภัยได้"
      },
      csharp: {
        title: "C#",
        code: `// Array ขนาดคงที่
string[] staticArray = new string[3];
staticArray[0] = "Apple";

// List: อาเรย์ยืดหยุ่นขยายได้เหมือน ArrayList ของ Java
using System.Collections.Generic;
List<string> fruits = new List<string>();
fruits.Add("Apple");
fruits.Add("Banana");

// เข้าถึงข้อมูล
Console.WriteLine(fruits[0]); // "Apple"`,
        explanation: "C# ก็แบ่งระหว่าง Array พื้นฐานขนาดคงที่ และ `List<T>` สำหรับข้อมูลที่ขยายขนาดได้ มีระบบ LINQ ช่วยคิวรี่ข้อมูลได้คล้าย SQL และฟังก์ชัน map ของ JS"
      }
    }
  }
];

// Algorithms Visualizer Data & Trace simulation
const visualizerData = {
  bubbleSort: {
    title: "Bubble Sort (การเรียงลำดับแบบฟองสบู่)",
    desc: "Bubble Sort เป็นอัลกอริทึมเรียงลำดับที่ง่ายที่สุด โดยทำการเปรียบเทียบข้อมูลคู่ที่อยู่ติดกันสลับตำแหน่งกันหากไม่ได้เรียงตามลำดับ ทำแบบนี้ซ้ำๆ จนกว่าทั้งอาร์เรย์จะเรียงเสร็จ (เหมือนฟองอากาศที่ลอยขึ้นเหนือน้ำ)",
    pseudocode: `for i from 0 to N-1:
    for j from 0 to N-i-2:
        if array[j] > array[j+1]:
            swap(array[j], array[j+1])`,
    initialArray: [29, 10, 14, 37, 8, 22],
    generateSteps: (arr) => {
      let array = [...arr];
      let steps = [];
      let n = array.length;
      
      // Initial step
      steps.push({
        array: [...array],
        comparing: [-1, -1],
        swapped: false,
        i: 0,
        j: 0,
        desc: "เริ่มต้นกำหนดอาร์เรย์ที่ไม่ได้เรียงลำดับ",
        highlights: [0]
      });

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n - i - 1; j++) {
          // step showing comparison
          steps.push({
            array: [...array],
            comparing: [j, j + 1],
            swapped: false,
            i: i,
            j: j,
            desc: `เปรียบเทียบค่าระหว่าง index ${j} (${array[j]}) และ index ${j+1} (${array[j+1]})`,
            highlights: [2]
          });

          if (array[j] > array[j + 1]) {
            // Swap
            let temp = array[j];
            array[j] = array[j + 1];
            array[j + 1] = temp;

            steps.push({
              array: [...array],
              comparing: [j, j + 1],
              swapped: true,
              i: i,
              j: j,
              desc: `เนื่องจาก ${temp} > ${array[j]} จึงทำการสลับที่กัน (Swap)`,
              highlights: [3, 4]
            });
          } else {
            steps.push({
              array: [...array],
              comparing: [j, j + 1],
              swapped: false,
              i: i,
              j: j,
              desc: `เนื่องจาก ${array[j]} <= ${array[j+1]} จึงคงที่ไว้ ไม่เกิดการสลับตำแหน่ง`,
              highlights: [3]
            });
          }
        }
        steps.push({
          array: [...array],
          comparing: [-1, -1],
          swapped: false,
          i: i,
          j: -1,
          desc: `จบรอบที่ ${i + 1} ตัวเลขที่มีค่าสูงสุดในรอบนี้คือ ${array[n - i - 1]} ถูกเรียงไว้ที่ตำแหน่งท้ายสุดอย่างถูกต้องเรียบร้อย`,
          highlights: [1]
        });
      }

      steps.push({
        array: [...array],
        comparing: [-1, -1],
        swapped: false,
        i: n,
        j: -1,
        desc: "อาร์เรย์เรียงลำดับสมบูรณ์แบบเรียบร้อยแล้ว! (เวลาเฉลี่ย: O(N²))",
        highlights: []
      });

      return steps;
    }
  },
  binarySearch: {
    title: "Binary Search (การค้นหาแบบทวิภาค)",
    desc: "อัลกorิทึมสำหรับค้นหาข้อมูลในอาร์เรย์ที่ **ต้องเรียงลำดับแล้วเท่านั้น** โดยทำการแบ่งครึ่งข้อมูลออกเป็นสองส่วน แล้วตัดส่วนที่ไม่เกี่ยวข้องออกไปทีละครึ่ง ทำให้ค้นหาได้เร็วมากๆ ในระดับ O(log N)",
    pseudocode: `low = 0, high = N-1
while low <= high:
    mid = (low + high) / 2
    if array[mid] == target: return mid
    else if array[mid] < target: low = mid + 1
    else: high = mid - 1`,
    initialArray: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91],
    target: 23,
    generateSteps: (arr, target) => {
      let array = [...arr];
      let steps = [];
      let low = 0;
      let high = array.length - 1;
      
      steps.push({
        array: [...array],
        low: low,
        high: high,
        mid: -1,
        desc: `เริ่มต้นค้นหาเลข ${target} กำหนดช่วงเริ่มต้นตั้งแต่ index ${low} ถึง ${high}`,
        highlights: [0]
      });

      let found = false;
      let stepsCount = 0;

      while (low <= high && stepsCount < 15) {
        stepsCount++;
        let mid = Math.floor((low + high) / 2);
        
        steps.push({
          array: [...array],
          low: low,
          high: high,
          mid: mid,
          desc: `คำนวณตำแหน่งกึ่งกลาง mid = (${low} + ${high}) / 2 = ${mid}. ค่าที่จุดกึ่งกลางคือ ${array[mid]}`,
          highlights: [2]
        });

        if (array[mid] === target) {
          found = true;
          steps.push({
            array: [...array],
            low: low,
            high: high,
            mid: mid,
            desc: `ยินดีด้วย! พบเป้าหมายที่ตำแหน่ง index ${mid} (${array[mid]} === ${target}) จบการค้นหา`,
            highlights: [3]
          });
          break;
        } else if (array[mid] < target) {
          let prevLow = low;
          low = mid + 1;
          steps.push({
            array: [...array],
            low: low,
            high: high,
            mid: mid,
            desc: `เนื่องจาก ${array[mid]} น้อยกว่าเป้าหมาย (${target}) ข้อมูลต้องอยู่ครึ่งฝั่งขวา ขยับช่วงฝั่งซ้าย: low = mid + 1 (${low})`,
            highlights: [4]
          });
        } else {
          let prevHigh = high;
          high = mid - 1;
          steps.push({
            array: [...array],
            low: low,
            high: high,
            mid: mid,
            desc: `เนื่องจาก ${array[mid]} มากกว่าเป้าหมาย (${target}) ข้อมูลต้องอยู่ครึ่งฝั่งซ้าย ขยับช่วงฝั่งขวา: high = mid - 1 (${high})`,
            highlights: [5]
          });
        }
      }

      if (!found) {
        steps.push({
          array: [...array],
          low: low,
          high: high,
          mid: -1,
          desc: `ไม่พบเป้าหมาย ${target} ในอาร์เรย์นี้หลังจากขอบเขตสิ้นสุดลง (low > high)`,
          highlights: []
        });
      }

      return steps;
    }
  },
  recursion: {
    title: "Recursion (ฟังก์ชันเรียกตัวเอง - แฟกทอเรียล)",
    desc: "Recursion คือฟังก์ชันที่ทำงานซ้ำโดยการ **เรียกตัวเองซ้ำๆ** เพื่อแบ่งย่อยปัญหาออกเป็นปัญหาย่อยที่เล็กลงจนกว่าจะเจอกรณีพื้นฐาน (Base Case) แล้วส่งค่าผลลัพธ์ย้อนกลับขึ้นมา (Call Stack)",
    pseudocode: `function factorial(n):
    if n <= 1: return 1  // Base Case
    return n * factorial(n - 1) // Recursive Case`,
    n: 4,
    generateSteps: (n) => {
      let steps = [];
      let stack = [];
      
      // Step-by-step trace of call phase
      function factTrace(val) {
        stack.push({ level: val, text: `factorial(${val})` });
        
        steps.push({
          n: val,
          stack: [...stack],
          phase: "CALL",
          desc: `เรียกฟังก์ชัน factorial(${val}). ทำการบันทึกระดับการทำงานลงในหน่วยความจำ Stack`,
          highlights: [0]
        });

        if (val <= 1) {
          steps.push({
            n: val,
            stack: [...stack],
            phase: "BASE",
            returnValue: 1,
            desc: `พบกรณีพื้นฐาน (Base Case): n <= 1 เป็นจริง คืนค่ากลับเป็น 1 เพื่อหยุดลูปการเรียกตัวเอง`,
            highlights: [1]
          });
          stack.pop();
          return 1;
        }

        let subResult = factTrace(val - 1);
        let result = val * subResult;
        
        steps.push({
          n: val,
          stack: [...stack],
          phase: "RETURN",
          returnValue: result,
          desc: `คำนวณผลลัพธ์ของ factorial(${val}) = ${val} * factorial(${val-1}) (${subResult}) = ${result}. ส่งค่ากลับและดึงข้อมูลออกจาก Stack`,
          highlights: [2]
        });
        
        if (stack.length > 0) stack.pop();
        return result;
      }

      factTrace(n);
      
      steps.push({
        n: n,
        stack: [],
        phase: "FINISH",
        returnValue: 24,
        desc: `เรียบร้อยแล้ว! ผลลัพธ์สุดท้ายที่ส่งกลับจาก Call Stack คือ 24 (4 * 3 * 2 * 1)`,
        highlights: []
      });

      return steps;
    }
  }
};

// ===== Additional Syntax Topics =====
syntaxData.push(
  {
    id: "operators",
    title: "➕ Operators (ตัวดำเนินการ)",
    desc: "ตัวดำเนินการคือสัญลักษณ์พิเศษที่ใช้คำนวณค่า เปรียบเทียบ หรือควบคุมตรรกะในโปรแกรม แต่ละภาษามีตัวดำเนินการที่เหมือนกันบ้างและแตกต่างกันบ้างในรายละเอียด",
    languages: {
      js: {
        title: "JavaScript",
        code: `// คำนวณ
let x = 10 + 3;   // 13
let y = 10 % 3;   // 1  (เศษจากการหาร)
let z = 2 ** 8;   // 256 (ยกกำลัง ES6)

// เปรียบเทียบ (เสมอใช้ === ไม่ใช้ ==)
5 === 5    // true
5 === '5'  // false (ต่างชนิด!)
5 == '5'   // true  (ระวัง! Type Coercion)

// ตรรกะ
true && false  // false (AND)
true || false  // true  (OR)
!true          // false (NOT)

// Nullish Coalescing (ES2020)
let name = null ?? "Guest"; // "Guest"
// Optional Chaining
let city = user?.address?.city; // ไม่ Error ถ้า undefined`,
        explanation: "JavaScript มีตัวดำเนินการพิเศษอย่าง `??` (Nullish Coalescing) ที่คืนค่าขวาก็ต่อเมื่อค่าซ้ายเป็น null/undefined เท่านั้น (ไม่ใช่ false, 0, '') และ `?.` (Optional Chaining) ที่ป้องกัน TypeError เวลาเข้าถึง property ของค่าที่อาจเป็น undefined"
      },
      py: {
        title: "Python",
        code: `# คำนวณ
x = 10 + 3   # 13
y = 10 % 3   # 1  (เศษ)
z = 2 ** 8   # 256 (ยกกำลัง)
q = 10 // 3  # 3   (หารปัดเศษลง Floor Division)

# เปรียบเทียบ
5 == 5    # True
5 != 3    # True
5 is 5    # True  (identity check, ระวัง!)
5 is not None  # True

# ตรรกะ (ใช้คำภาษาอังกฤษ!)
True and False  # False
True or False   # True
not True        # False

# Walrus Operator (Python 3.8+)
if (n := len(data)) > 10:
    print(f"มีข้อมูล {n} รายการ")`,
        explanation: "Python ใช้คำภาษาอังกฤษ `and`, `or`, `not` แทนสัญลักษณ์ `&&`, `||`, `!` และมีตัวดำเนินการพิเศษ `//` (Floor Division) และ `:=` (Walrus Operator) ที่ประกาศและกำหนดค่าตัวแปรในที่เดียวกันได้"
      },
      java: {
        title: "Java",
        code: `// คำนวณ
int x = 10 + 3;    // 13
int y = 10 % 3;    // 1
double z = Math.pow(2, 8); // 256 (ไม่มี ** ต้องใช้ Math.pow)

// เปรียบเทียบ
int a = 5, b = 5;
a == b    // true  (primitive ใช้ == ได้)
// String ต้องใช้ .equals() !
"hello".equals("hello")  // true
"hello" == "hello"       // อาจเป็น false (ระวัง!)

// ตรรกะ
true && false  // false
true || false  // true
!true          // false

// Ternary
String msg = (x > 5) ? "มาก" : "น้อย";`,
        explanation: "Java ระวังเรื่องการเปรียบเทียบ String ด้วย `==` เพราะเป็นการเปรียบเทียบ reference ของออบเจกต์ ไม่ใช่ค่าตัวอักษร ต้องใช้เมธอด `.equals()` เสมอ และ Java ไม่มีตัวดำเนินการ `**` ต้องใช้ `Math.pow()`"
      },
      c: {
        title: "C",
        code: `// คำนวณ
int x = 10 + 3;    // 13
int y = 10 % 3;    // 1
#include <math.h>
double z = pow(2, 8); // 256 (ต้องใช้ library)

// เปรียบเทียบ
x == 13   // 1 (true ใน C คือ 1)
x != 13   // 0 (false ใน C คือ 0)

// ตรรกะ
x > 5 && y > 0   // 1 (true)
x > 100 || y > 0 // 1 (true)
!(x > 5)         // 0 (false)

// Bitwise (C เด่นมาก)
x & 0xFF   // AND บิต
x | 0x01   // OR บิต
x << 2     // เลื่อนบิตซ้าย (คูณ 4)`,
        explanation: "ภาษา C ใช้ตัวเลข 0 แทน false และ 1 (หรือตัวเลขอื่นที่ไม่ใช่ 0) แทน true ไม่มีชนิดข้อมูล Boolean แท้จริง (มีใน C99 ต้องรวม stdbool.h) และมีตัวดำเนินการระดับบิต (Bitwise) ที่ใช้ควบคุมข้อมูลระดับต่ำมาก"
      },
      csharp: {
        title: "C#",
        code: `// คำนวณ
int x = 10 + 3;    // 13
int y = 10 % 3;    // 1
double z = Math.Pow(2, 8); // 256

// เปรียบเทียบ
x == 13    // true
x != 13    // false
// String เปรียบเทียบด้วย == ได้เลย (overloaded)
"hello" == "hello"  // true ✅

// ตรรกะ
true && false  // false
true || false  // true
!true          // false

// Null-conditional และ Null-coalescing
string? name = null;
string result = name ?? "Guest";    // "Guest"
int? len = name?.Length;            // null (ไม่ Error)`,
        explanation: "C# มีระบบ Null Safety ที่ดีเยี่ยม สามารถระบุว่าตัวแปรอนุญาตให้เป็น null ได้ด้วยเครื่องหมาย `?` เช่น `string?` และมีตัวดำเนินการ `??` กับ `?.` เหมือน JavaScript ที่ช่วยจัดการค่า null ได้อย่างปลอดภัย"
      }
    }
  },
  {
    id: "string_methods",
    title: "🔤 String Methods (เมธอดจัดการข้อความ)",
    desc: "ทุกภาษาโปรแกรมมิ่งมีฟังก์ชันสำหรับจัดการข้อความ (String) ในตัว ตั้งแต่การค้นหา ตัด ต่อ แปลงตัวพิมพ์ ไปจนถึงการแยกและรวมข้อความ",
    languages: {
      js: {
        title: "JavaScript",
        code: `let s = "Hello, World!";

// ความยาว
s.length           // 13

// ค้นหาและตรวจสอบ
s.includes("World")      // true
s.startsWith("Hello")    // true
s.endsWith("!")          // true
s.indexOf("o")           // 4 (ตำแหน่งแรก)

// ตัดและแปลง
s.slice(7, 12)     // "World"
s.toUpperCase()    // "HELLO, WORLD!"
s.toLowerCase()    // "hello, world!"
s.trim()           // "Hello, World!" (ตัด whitespace หัวท้าย)
s.replace("World", "JS")  // "Hello, JS!"

// แยกและรวม
"a,b,c".split(",")        // ["a","b","c"]
["a","b","c"].join("-")   // "a-b-c"

// Template Literal (แนะนำ)
let name = "Alex";
\`สวัสดี \${name}!\`       // "สวัสดี Alex!"`,
        explanation: "JavaScript มีเมธอด String ที่ครบครันและใช้งานง่าย เมธอดเหล่านี้ **ไม่แก้ไข String ต้นฉบับ** (Immutable) แต่จะส่งคืน String ใหม่เสมอ นิยมใช้ Template Literal (`` ` ` ``) แทนการต่อ String ด้วย `+` เพราะอ่านง่ายกว่ามาก"
      },
      py: {
        title: "Python",
        code: `s = "Hello, World!"

# ความยาว
len(s)                  # 13 (ฟังก์ชัน ไม่ใช่ method!)

# ค้นหาและตรวจสอบ
"World" in s            # True (ใช้ in operator)
s.startswith("Hello")   # True (ตัวพิมพ์เล็ก!)
s.endswith("!")         # True
s.find("o")             # 4

# ตัดและแปลง
s[7:12]          # "World" (Slicing!)
s.upper()        # "HELLO, WORLD!"
s.lower()        # "hello, world!"
s.strip()        # ตัด whitespace หัวท้าย
s.replace("World", "Python")

# แยกและรวม
"a,b,c".split(",")          # ['a','b','c']
"-".join(["a","b","c"])     # "a-b-c" (join เรียกจาก separator!)

# f-string (แนะนำ Python 3.6+)
name = "Alex"
f"สวัสดี {name}!"           # "สวัสดี Alex!"`,
        explanation: "Python มีความแตกต่างสำคัญ: ความยาวใช้ฟังก์ชัน `len()` แทน `.length`, ค้นหาด้วย `in` operator ได้เลย, `.join()` เรียกจากตัว separator ไม่ใช่ List, และรองรับ Slicing `s[start:end]` ที่ทรงพลังมาก"
      },
      java: {
        title: "Java",
        code: `String s = "Hello, World!";

// ความยาว
s.length()          // 13 (ต้องใส่ () !)

// ค้นหาและตรวจสอบ
s.contains("World")        // true
s.startsWith("Hello")      // true
s.endsWith("!")            // true
s.indexOf("o")             // 4

// ตัดและแปลง
s.substring(7, 12)         // "World"
s.toUpperCase()            // "HELLO, WORLD!"
s.toLowerCase()            // "hello, world!"
s.trim()                   // ตัด whitespace
s.replace("World", "Java") // "Hello, Java!"

// แยกและรวม
"a,b,c".split(",")              // String[] = {"a","b","c"}
String.join("-", "a","b","c")  // "a-b-c"

// String.format (Java 8 ขึ้นไป)
String.format("สวัสดี %s!", "Alex")   // "สวัสดี Alex!"`,
        explanation: "Java ต้องใส่วงเล็บ `()` ทุกครั้งที่เรียกเมธอดรวมถึง `.length()` ด้วย เมธอด `.split()` คืนค่าเป็น `String[]` (อาเรย์ธรรมดา) ไม่ใช่ ArrayList และ String ใน Java เป็น Immutable เช่นกัน"
      },
      c: {
        title: "C",
        code: `#include <string.h>
#include <stdio.h>

char s[] = "Hello, World!";

// ความยาว
strlen(s)              // 13 (ไม่นับ \\0)

// ค้นหา
strstr(s, "World")     // คืน pointer ที่ตำแหน่งที่พบ (หรือ NULL)
strchr(s, 'o')         // คืน pointer ไปยัง 'o' แรก

// เปรียบเทียบ (ห้ามใช้ == กับ String!)
strcmp("hello", "hello")   // 0 (เท่ากัน)
strcmp("a", "b")           // ค่าลบ (a < b)

// คัดลอกและต่อ
char dest[50];
strcpy(dest, s)        // คัดลอก
strcat(dest, " Hi!")   // ต่อ string

// แปลงตัวเลข
int num = atoi("42");  // string -> int
char buf[20];
sprintf(buf, "%d", num); // int -> string`,
        explanation: "ภาษา C ไม่มี String type จริงๆ เป็นเพียง array ของ char ที่ปิดด้วย null character '\\0' ดังนั้นต้องระวัง buffer overflow เมื่อใช้ `strcpy`/`strcat` และ **ห้ามเปรียบเทียบ String ด้วย `==`** เพราะจะเปรียบเทียบ pointer ไม่ใช่เนื้อหา"
      },
      csharp: {
        title: "C#",
        code: `string s = "Hello, World!";

// ความยาว
s.Length           // 13 (Property ไม่ใช่ method!)

// ค้นหา
s.Contains("World")        // true
s.StartsWith("Hello")      // true
s.EndsWith("!")            // true
s.IndexOf("o")             // 4

// ตัดและแปลง
s.Substring(7, 5)          // "World" (start, length!)
s.ToUpper()                // "HELLO, WORLD!"
s.ToLower()                // "hello, world!"
s.Trim()                   // ตัด whitespace
s.Replace("World", "C#")   // "Hello, C#!"

// แยกและรวม
"a,b,c".Split(',')                     // string[] = {"a","b","c"}
string.Join("-", new[]{"a","b","c"})   // "a-b-c"

// String Interpolation (แนะนำ C# 6+)
string name = "Alex";
$"สวัสดี {name}!"          // "สวัสดี Alex!"`,
        explanation: "C# ใช้ PascalCase สำหรับเมธอดและ Property เช่น `.Length` (ไม่มีวงเล็บ!), `.Contains()`, `.StartsWith()` และมี String Interpolation ด้วย `$\"...{variable}...\"` ที่ทำงานเหมือน Template Literal ของ JavaScript"
      }
    }
  },
  {
    id: "oop",
    title: "🏛️ OOP (การเขียนโปรแกรมเชิงวัตถุ)",
    desc: "Object-Oriented Programming คือรูปแบบการเขียนโปรแกรมที่จัดการข้อมูลและพฤติกรรมไว้ในหน่วยที่เรียกว่า 'ออบเจกต์' ช่วยจัดโครงสร้างโค้ดให้เป็นระเบียบ นำกลับมาใช้ซ้ำได้ และขยายระบบง่ายขึ้น",
    languages: {
      js: {
        title: "JavaScript",
        code: `class Animal {
  #name; // Private field (ES2022)
  
  constructor(name, sound) {
    this.#name = name;
    this.sound = sound;
  }
  
  // Getter
  get name() { return this.#name; }
  
  speak() {
    return \`\${this.#name} พูดว่า: \${this.sound}!\`;
  }
}

// Inheritance
class Dog extends Animal {
  constructor(name) {
    super(name, "โฮ่ง");
    this.tricks = [];
  }
  
  learn(trick) {
    this.tricks.push(trick);
  }
  
  // Method Override
  speak() {
    return super.speak() + " (หมาน่ารักมาก!)";
  }
}

const dog = new Dog("บัดดี้");
console.log(dog.speak());
dog.learn("นั่ง");`,
        explanation: "JavaScript รองรับ OOP ด้วย Class Syntax (ES6) ที่เป็น Syntactic Sugar บน Prototype-based system การใช้ `#` นำหน้าทำให้เป็น Private field ที่เข้าถึงได้เฉพาะภายใน class `extends` ใช้สืบทอด และ `super()` เรียกคอนสตรัคเตอร์แม่"
      },
      py: {
        title: "Python",
        code: `class Animal:
    def __init__(self, name: str, sound: str):
        self.__name = name    # Private (name mangling)
        self.sound = sound
    
    @property
    def name(self) -> str:
        return self.__name
    
    def speak(self) -> str:
        return f"{self.__name} พูดว่า: {self.sound}!"

class Dog(Animal):  # ใส่ class แม่ในวงเล็บ
    def __init__(self, name: str):
        super().__init__(name, "โฮ่ง")
        self.tricks = []
    
    def learn(self, trick: str):
        self.tricks.append(trick)
    
    def speak(self) -> str:  # Override
        return super().speak() + " (หมาน่ารักมาก!)"

dog = Dog("บัดดี้")
print(dog.speak())
dog.learn("นั่ง")`,
        explanation: "Python ใช้ `__init__` แทน constructor และกำหนด private attribute ด้วย `__` นำหน้า (Name Mangling) ใช้ `@property` decorator สร้าง getter, ระบุ class แม่ในวงเล็บ และเรียก `super()` ในการสืบทอด สามารถ Override method ได้โดยประกาศชื่อเดิมใน subclass"
      },
      java: {
        title: "Java",
        code: `// abstract class บังคับให้ subclass implement
public abstract class Animal {
    private String name;  // Private
    protected String sound;
    
    public Animal(String name, String sound) {
        this.name = name;
        this.sound = sound;
    }
    
    // Getter
    public String getName() { return name; }
    
    public String speak() {
        return name + " พูดว่า: " + sound + "!";
    }
}

public class Dog extends Animal {
    private List<String> tricks = new ArrayList<>();
    
    public Dog(String name) {
        super(name, "โฮ่ง");
    }
    
    public void learn(String trick) {
        tricks.add(trick);
    }
    
    @Override
    public String speak() {
        return super.speak() + " (หมาน่ารักมาก!)";
    }
}`,
        explanation: "Java บังคับใช้ Access Modifiers (`private`, `protected`, `public`) อย่างเข้มงวด และต้องเขียน Getter/Setter ด้วยตัวเอง annotation `@Override` ช่วยให้ compiler ตรวจสอบว่า method นี้ override จาก parent จริงๆ ทุก class ใน Java สืบทอดจาก `Object` โดยอัตโนมัติ"
      },
      c: {
        title: "C",
        code: `// C ไม่มี OOP แท้ แต่จำลองได้ด้วย struct
#include <stdio.h>
#include <string.h>

typedef struct {
    char name[50];
    char sound[20];
    void (*speak)(struct Animal*); // Function pointer
} Animal;

void animal_speak(Animal* self) {
    printf("%s พูดว่า: %s!\\n", self->name, self->sound);
}

// "Constructor"
Animal create_animal(const char* name, const char* sound) {
    Animal a;
    strcpy(a.name, name);
    strcpy(a.sound, sound);
    a.speak = animal_speak;  // กำหนด method
    return a;
}

int main() {
    Animal dog = create_animal("บัดดี้", "โฮ่ง");
    dog.speak(&dog);  // เรียก method
    return 0;
}`,
        explanation: "ภาษา C ไม่มี OOP โดยกำเนิด แต่นักพัฒนาจำลองพฤติกรรม OOP ได้โดยใช้ `struct` เก็บข้อมูล (เหมือน field/attribute) และ **Function Pointer** เก็บฟังก์ชัน (เหมือน method) รูปแบบนี้เป็นพื้นฐานของการพัฒนา C++ ซึ่งเพิ่ม OOP เต็มรูปแบบ"
      },
      csharp: {
        title: "C#",
        code: `public abstract class Animal {
    private string name;
    protected string Sound { get; set; }  // Auto-property
    
    protected Animal(string name, string sound) {
        this.name = name;
        Sound = sound;
    }
    
    public string Name => name;  // Expression-bodied property
    
    public virtual string Speak() =>
        $"{name} พูดว่า: {Sound}!";
}

public class Dog : Animal {    // : แทน extends
    public List<string> Tricks { get; } = new();
    
    public Dog(string name) : base(name, "โฮ่ง") { }
    
    public void Learn(string trick) => Tricks.Add(trick);
    
    public override string Speak() =>
        base.Speak() + " (หมาน่ารักมาก!)";
}

var dog = new Dog("บัดดี้");
Console.WriteLine(dog.Speak());`,
        explanation: "C# ใช้ `:` แทน `extends` ในการสืบทอด มี Auto-Property ที่เขียนสั้นกว่า Java มาก ใช้ `virtual` ในเมธอดแม่เพื่ออนุญาตให้ลูก Override และใช้ `override` ในลูกเพื่อยืนยัน สามารถเขียนเมธอดแบบ Expression-bodied `=>` ได้เพื่อความกระชับ"
      }
    }
  },
  {
    id: "error_handling",
    title: "⚠️ Error Handling (การจัดการข้อผิดพลาด)",
    desc: "การจัดการข้อผิดพลาดอย่างถูกต้องทำให้โปรแกรมไม่ล่มเมื่อเกิดเหตุการณ์ไม่คาดคิด แต่ละภาษามีรูปแบบและคำศัพท์ที่ใช้ต่างกัน",
    languages: {
      js: {
        title: "JavaScript",
        code: `// try / catch / finally
try {
  const data = JSON.parse("ข้อมูลเสีย"); // เกิด Error
  console.log(data);
} catch (error) {
  // error.name    = "SyntaxError"
  // error.message = "Unexpected token..."
  console.error("เกิดข้อผิดพลาด:", error.message);
} finally {
  console.log("ทำทุกครั้ง ไม่ว่าจะ Error หรือไม่");
}

// โยน Error เอง
function divide(a, b) {
  if (b === 0) throw new Error("หารด้วยศูนย์ไม่ได้!");
  return a / b;
}

// Async Error Handling
async function fetchData(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    return await res.json();
  } catch (err) {
    console.error("Fetch failed:", err.message);
    return null;
  }
}`,
        explanation: "JavaScript ใช้ `try/catch/finally` สำหรับจัดการ Error ส่วนการใช้งานกับ Async ต้องใช้ `await` ภายใน `try` เสมอ และ `finally` จะทำงานเสมอไม่ว่าจะเกิด Error หรือไม่ เหมาะสำหรับปิด connection หรือ cleanup resource"
      },
      py: {
        title: "Python",
        code: `# try / except / else / finally
try:
    data = int("ข้อมูลเสีย")   # เกิด ValueError
    print(data)
except ValueError as e:
    print(f"ValueError: {e}")
except (TypeError, AttributeError) as e:
    print(f"Type error: {e}")   # ดักจับหลายชนิดพร้อมกัน
else:
    print("ไม่มี Error!")       # ทำเฉพาะเมื่อไม่มี Error
finally:
    print("ทำทุกครั้งเสมอ")

# โยน Exception เอง
def divide(a, b):
    if b == 0:
        raise ValueError("หารด้วยศูนย์ไม่ได้!")
    return a / b

# Custom Exception Class
class InsufficientFundsError(Exception):
    def __init__(self, amount):
        super().__init__(f"ยอดเงินไม่เพียงพอ: {amount}")`,
        explanation: "Python ใช้ `except` แทน `catch` และมี `else` block พิเศษที่ทำงานเฉพาะเมื่อไม่เกิด exception ซึ่ง JS ไม่มี สามารถดักจับหลาย Exception type ใน `except` เดียวด้วย tuple `(TypeError, ValueError)` และการโยนใช้คำว่า `raise` แทน `throw`"
      },
      java: {
        title: "Java",
        code: `// Checked vs Unchecked Exception
// Checked: ต้อง handle หรือประกาศ throws
// Unchecked (RuntimeException): ไม่บังคับ

try {
    int[] arr = new int[5];
    arr[10] = 1;  // ArrayIndexOutOfBoundsException
    
    // Checked Exception
    FileReader file = new FileReader("test.txt");
    
} catch (ArrayIndexOutOfBoundsException e) {
    System.out.println("Array เกิน: " + e.getMessage());
} catch (FileNotFoundException e) {
    System.out.println("ไม่พบไฟล์: " + e.getMessage());
} finally {
    System.out.println("Cleanup ทรัพยากร");
}

// Custom Exception
public class InsufficientFundsException extends Exception {
    public InsufficientFundsException(double amount) {
        super("ยอดเงินไม่พอ: " + amount);
    }
}

// Method ที่โยน Checked Exception ต้องประกาศ
public void withdraw(double amount) throws InsufficientFundsException {
    if (amount > balance) throw new InsufficientFundsException(amount);
}`,
        explanation: "Java แยก Exception เป็น 2 ชนิด: **Checked Exception** ที่ compiler บังคับให้ handle หรือประกาศ `throws` ในลายเซ็นเมธอด และ **Unchecked Exception** (RuntimeException) ที่ไม่บังคับ ทำให้ API ของ Java สื่อความหมายชัดว่าเมธอดไหนอาจล้มเหลวได้"
      },
      c: {
        title: "C",
        code: `#include <errno.h>
#include <stdio.h>
#include <stdlib.h>

// C ไม่มี try/catch! ใช้ return code แทน
int divide(int a, int b, int *result) {
    if (b == 0) {
        errno = EINVAL;   // กำหนด error code
        return -1;        // ส่งรหัสผิดพลาดกลับ
    }
    *result = a / b;
    return 0;             // 0 = สำเร็จ
}

int main() {
    int result;
    if (divide(10, 0, &result) != 0) {
        perror("divide failed");  // แสดง error
        return EXIT_FAILURE;
    }
    printf("ผลลัพธ์: %d\\n", result);
    return EXIT_SUCCESS;
}

// setjmp/longjmp (advanced: คล้าย try/catch แต่อันตราย)
#include <setjmp.h>
jmp_buf jump_buffer;
// setjmp(jump_buffer);    // จุดรับ
// longjmp(jump_buffer, 1); // กระโดดกลับ`,
        explanation: "ภาษา C ไม่มีกลไก try/catch โดยกำเนิด แต่ใช้รูปแบบ **Return Code** คืนค่า 0 หรือ -1 เป็นสัญญาณสำเร็จ/ล้มเหลว และใช้ global variable `errno` เก็บรหัสข้อผิดพลาด รูปแบบนี้บังคับให้ programmer ตรวจสอบผลลัพธ์ทุกครั้ง"
      },
      csharp: {
        title: "C#",
        code: `// try / catch / finally
try {
    int[] arr = new int[5];
    arr[10] = 1;  // IndexOutOfRangeException
    
} catch (IndexOutOfRangeException ex) {
    Console.WriteLine($"เกิน Array: {ex.Message}");
} catch (Exception ex) when (ex.Message.Contains("null")) {
    // Exception filter (C# 6+)
    Console.WriteLine("Null reference issue");
} finally {
    Console.WriteLine("Cleanup เสมอ");
}

// Custom Exception
public class InsufficientFundsException : Exception {
    public decimal Amount { get; }
    
    public InsufficientFundsException(decimal amount)
        : base($"ยอดเงินไม่พอ: {amount:C}") {
        Amount = amount;
    }
}

// Using statement (auto cleanup)
using var file = new StreamReader("test.txt");
string content = file.ReadToEnd(); // ปิดไฟล์อัตโนมัติ`,
        explanation: "C# มี Exception filter ด้วย `when` clause (C# 6+) ที่ช่วยกรอง exception ก่อน catch และมี `using` statement ที่เรียก `Dispose()` อัตโนมัติเมื่อออกจาก scope ป้องกัน resource leak โดยไม่ต้องเขียน finally"
      }
    }
  }
);

// Quiz database with answers and detailed explanations
const quizQuestions = [
  {
    id: 1,
    type: "multiple-choice",
    language: "general",
    difficulty: "easy",
    question: "ข้อใดให้คำจำกัดความของคำว่า Static Typing และ Dynamic Typing ได้ถูกต้องที่สุด?",
    options: [
      "Static Typing ไม่ต้องระบุประเภทข้อมูลตอนประกาศตัวแปร แต่ Dynamic Typing ต้องระบุ",
      "Static Typing ต้องระบุประเภทข้อมูลของตัวแปรตั้งแต่ช่วงคอมไพล์โค้ด ส่วน Dynamic Typing จะเช็คประเภทข้อมูลอัตโนมัติขณะโปรแกรมทำงาน (Runtime)",
      "Static Typing รันเร็วกว่า Dynamic Typing เสมอ ไม่มีส่วนอื่นต่างกัน",
      "Static Typing ใช้ได้เฉพาะกับลูป ส่วน Dynamic Typing ใช้ได้กับเงื่อนไขเท่านั้น"
    ],
    answer: 1,
    explanation: "Static Typing (เช่น Java, C) บังคับระบุประเภทตัวแปรตั้งแต่ช่วงเขียนโค้ดและจะจับ Error ประเภทตัวแปรได้ในตอน Compile ส่วน Dynamic Typing (เช่น JS, Python) จะกำหนดชนิดข้อมูลโดยดูจากค่าที่ตัวแปรเก็บขณะโปรแกรมรัน"
  },
  {
    id: 2,
    type: "multiple-choice",
    language: "py",
    difficulty: "medium",
    question: "ในภาษา Python, หากคุณมีโค้ด `x = 5; print('ผลลัพธ์: ' + x)` จะเกิดผลลัพธ์อย่างไรเมื่อสั่งทำงาน?",
    options: [
      "แสดงผลออกหน้าจอว่า 'ผลลัพธ์: 5'",
      "แสดงผลออกหน้าจอว่า 'ผลลัพธ์: x'",
      "เกิด Error (TypeError) เพราะ Python ไม่สามารถนำ String มาต่อกับ Integer ได้โดยตรง",
      "โปรแกรมข้ามบรรทัดนี้ไปและไม่พิมพ์อะไรออกจอ"
    ],
    answer: 2,
    explanation: "Python เป็น Strongly Typed ไม่ยอมให้นำข้อมูลคนละประเภทมาต่อเชื่อมกันตรงๆ ต้องทำการแปลงก่อนเป็น: `print('ผลลัพธ์: ' + str(x))`"
  },
  {
    id: 3,
    type: "multiple-choice",
    language: "js",
    difficulty: "easy",
    question: "ใน JavaScript ความแตกต่างระหว่างเครื่องหมายเปรียบเทียบ `==` และ `===` คืออะไร?",
    options: [
      "เครื่องหมาย `==` ทำการสลับตำแหน่งค่าก่อนเปรียบเทียบ ส่วน `===` จะเปรียบเทียบตรงๆ",
      "เครื่องหมาย `==` ตรวจสอบความถูกต้องและเปรียบเทียบเฉพาะค่าโดยอาจละเลยความต่างของชนิดข้อมูล (Type Coercion) ส่วน `===` ตรวจสอบทั้งค่าและชนิดข้อมูลว่าตรงกันทุกประการ",
      "เครื่องหมาย `==` ใช้กับตัวแปรคงที่ (const) และ `===` ใช้กับตัวแปรทั่วไป (let)",
      "ไม่มีความแตกต่างกัน ใช้งานแทนกันได้ทุกประการ"
    ],
    answer: 1,
    explanation: "เครื่องหมาย `===` คือ Strict Equality ซึ่งจะเช็คทั้งค่า (Value) และชนิดข้อมูล (Type) เช่น `5 === '5'` ผลลัพธ์เป็น false ในขณะที่ `5 == '5'` ผลลัพธ์เป็น true เพราะเกิดการแปลงชนิดข้อมูลอัตโนมัติ"
  },
  {
    id: 4,
    type: "multiple-choice",
    language: "c",
    difficulty: "medium",
    question: "ในภาษา C หากประกาศข้อความว่า `char str[] = \"Hello\";` หน่วยความจำของอาร์เรย์นี้จะมีขนาดกี่ไบต์?",
    options: [
      "5 ไบต์ (เพราะมีตัวอักษร 5 ตัว)",
      "6 ไบต์ (เพราะมี Null Terminator '\\0' ปิดท้ายข้อความอีก 1 ไบต์)",
      "4 ไบต์ (ตามสถาปัตยกรรมของบิต)",
      "ไม่สามารถบอกขนาดได้ขึ้นอยู่กับระบบปฏิบัติการ"
    ],
    answer: 1,
    explanation: "ข้อความในภาษา C จะลงท้ายด้วยตัวอักษรพิเศษเสมอ คือ Null Terminator หรือ '\\0' เพื่อใช้เป็นสัญลักษณ์จบบรรทัดข้อความ ดังนั้นคำว่า \"Hello\" จึงประกอบไปด้วย H-e-l-l-o-'\\0' รวมเป็น 6 ไบต์"
  },
  {
    id: 5,
    type: "multiple-choice",
    language: "general",
    difficulty: "hard",
    question: "อัลกอริทึม Binary Search จำเป็นต้องประมวลผลบนเงื่อนไขหรือสถานะใดของอาร์เรย์เป็นสำคัญที่สุด?",
    options: [
      "อาร์เรย์จะต้องมีความยาวเป็นเลขคู่เท่านั้น",
      "ข้อมูลในอาร์เรย์จะต้องได้รับการเรียงลำดับ (Sorted Array) จากน้อยไปหามากหรือมากไปหาน้อยมาก่อนหน้านี้แล้ว",
      "อาร์เรย์ต้องเก็บข้อมูลประเภทตัวเลขทศนิยมเป็นหลัก",
      "ต้องมีหน่วยความจำสำรองมากกว่าครึ่งหนึ่งของโปรแกรม"
    ],
    answer: 1,
    explanation: "Binary Search จะใช้หลักการแบ่งครึ่ง หากข้อมูลในอาร์เรย์ไม่มีการเรียงลำดับล่วงหน้า การแบ่งครึ่งเพื่อตัดข้อมูลฝั่งใดฝั่งหนึ่งออกจะไม่เสถียรและทำงานผิดพลาดทันที ดั้งนั้นอาร์เรย์ **ต้องเรียงข้อมูลแล้วเท่านั้น**"
  },
  {
    id: 6,
    type: "multiple-choice",
    language: "java",
    difficulty: "medium",
    question: "ในภาษา Java ตัวแปรประเภท ArrayList แตกต่างจากอาเรย์ธรรมดา (Primitive Array) ในข้อใดเด่นชัดที่สุด?",
    options: [
      "ArrayList เร็วกว่าอาเรย์ธรรมดา 10 เท่า",
      "ArrayList สามารถขยายขนาดหรือหดขนาดได้โดยอัตโนมัติเมื่อมีการเพิ่มหรือลดข้อมูล ส่วนอาเรย์ทั่วไปมีขนาดที่คงที่",
      "ArrayList เก็บข้อมูลที่เป็น primitive types อย่าง int หรือ char ได้ตรงๆ โดยไม่ต้องใช้วัตถุครอบ",
      "ArrayList เก็บได้เฉพาะข้อความยาวๆ เท่านั้น"
    ],
    answer: 1,
    explanation: "ArrayList เป็นคลาสในเฟรมเวิร์ก Collection ของ Java ที่มีความยืดหยุ่นสูง สามารถปรับปรุงขนาดของตนเองได้แบบไดนามิก แตกต่างจากอาเรย์ธรรมดาที่จะต้องระบุขนาดตายตัวตั้งแต่เริ่มจัดสรรหน่วยความจำ"
  },
  {
    id: 7,
    type: "multiple-choice",
    language: "js",
    difficulty: "medium",
    question: "โค้ด JavaScript ต่อไปนี้ `[1,2,3].map(x => x * 2).filter(x => x > 3)` จะให้ผลลัพธ์อะไร?",
    options: [
      "[2, 4, 6]",
      "[4, 6]",
      "[1, 2, 3]",
      "เกิด Error เพราะ .map() และ .filter() ใช้ร่วมกันไม่ได้"
    ],
    answer: 1,
    explanation: ".map(x => x*2) แปลง [1,2,3] เป็น [2,4,6] ก่อน จากนั้น .filter(x => x>3) กรองเฉพาะค่าที่มากกว่า 3 ได้ [4,6] วิธีนี้เรียกว่า Method Chaining ที่ทำให้โค้ดอ่านง่ายและกระชับ"
  },
  {
    id: 8,
    type: "multiple-choice",
    language: "py",
    difficulty: "easy",
    question: "ใน Python คำสั่งใดที่เทียบเท่ากับ `numbers.map(x => x * 2)` ของ JavaScript มากที่สุด?",
    options: [
      "numbers.transform(lambda x: x * 2)",
      "[x * 2 for x in numbers]  หรือ  list(map(lambda x: x*2, numbers))",
      "numbers.each(n => n * 2)",
      "for x in numbers: x * 2"
    ],
    answer: 1,
    explanation: "Python ไม่มีเมธอด .map() ในตัว แต่สามารถใช้ List Comprehension [x*2 for x in numbers] ซึ่งเป็นวิธีที่ Pythonic ที่สุด หรือใช้ฟังก์ชัน map() ร่วมกับ lambda แล้วแปลงเป็น list ด้วย list()"
  },
  {
    id: 9,
    type: "multiple-choice",
    language: "general",
    difficulty: "medium",
    question: "ข้อใดอธิบาย 'Recursion' หรือการเรียกฟังก์ชันตัวเองซ้ำๆ (Recursive Function) ได้ถูกต้องที่สุด?",
    options: [
      "ฟังก์ชันที่รับค่าหลายตัวพร้อมกันโดยใช้ Array",
      "ฟังก์ชันที่เรียกตัวเองซ้ำๆ โดยต้องมี Base Case (เงื่อนไขหยุด) เพื่อป้องกัน Stack Overflow",
      "ฟังก์ชันที่ทำงานแบบ Asynchronous โดยไม่บล็อก Thread หลัก",
      "ฟังก์ชันที่ประกาศภายในฟังก์ชันอื่น (Nested Function)"
    ],
    answer: 1,
    explanation: "Recursion คือเทคนิคที่ฟังก์ชันเรียกตัวเองซ้ำ โดยแบ่งปัญหาใหญ่ออกเป็นปัญหาย่อยที่เล็กลง ต้องมี Base Case เพื่อหยุด ไม่เช่นนั้น Stack ในหน่วยความจำจะล้น (Stack Overflow) ตัวอย่างคลาสสิกคือ แฟกทอเรียล: factorial(n) = n * factorial(n-1)"
  },
  {
    id: 10,
    type: "multiple-choice",
    language: "js",
    difficulty: "hard",
    question: "ใน JavaScript โค้ด `console.log(typeof null)` จะแสดงผลอะไร?",
    options: [
      "\"null\"",
      "\"undefined\"",
      "\"object\"",
      "\"boolean\""
    ],
    answer: 2,
    explanation: "นี่คือ Bug ที่มีชื่อเสียงที่สุดของ JavaScript! `typeof null` คืนค่า `\"object\"` ซึ่งผิดพลาดมาตั้งแต่แรก (JavaScript version 1) แต่ไม่สามารถแก้ไขได้แล้วเพราะจะทำให้โค้ดเก่าพัง ดังนั้นในการตรวจสอบ null ต้องใช้ `=== null` ไม่ใช่ `typeof`"
  },
  {
    id: 11,
    type: "multiple-choice",
    language: "general",
    difficulty: "medium",
    question: "Time Complexity O(n log n) ของอัลกอริทึมเรียงลำดับแบบ Merge Sort แตกต่างจาก O(n²) ของ Bubble Sort อย่างไรในทางปฏิบัติ?",
    options: [
      "ไม่มีความแตกต่าง ทั้งคู่เร็วเท่ากันเมื่อข้อมูลน้อยกว่า 1,000 รายการ",
      "เมื่อข้อมูล 1 ล้านรายการ Merge Sort ใช้เวลาประมาณ 20 ล้านขั้น ส่วน Bubble Sort ใช้ 1,000,000,000,000 ขั้น (ต่างกัน 50,000 เท่า!)",
      "Bubble Sort เร็วกว่าเมื่อข้อมูลเกิน 1,000 รายการ เพราะใช้หน่วยความจำน้อยกว่า",
      "ทั้งคู่เหมาะสมสำหรับข้อมูลทุกขนาดเพียงแค่ Bubble Sort อ่านโค้ดง่ายกว่าเท่านั้น"
    ],
    answer: 1,
    explanation: "ที่ n=1,000,000: O(n log n) ≈ 20,000,000 ขั้น ส่วน O(n²) = 1,000,000,000,000 ขั้น ต่างกันกว่า 50,000 เท่า! นี่คือเหตุผลที่การเลือก Algorithm ที่เหมาะสมสำคัญมากในระบบจริง Bubble Sort ใช้สอนแนวคิดเท่านั้น ไม่ควรนำไปใช้กับข้อมูลจำนวนมาก"
  },
  {
    id: 12,
    type: "multiple-choice",
    language: "csharp",
    difficulty: "medium",
    question: "ใน C# ความแตกต่างระหว่าง `class` และ `struct` คืออะไร?",
    options: [
      "struct เร็วกว่า class เสมอ ควรใช้ struct แทน class ในทุกกรณี",
      "class เป็น Reference Type (เก็บ reference บน Heap) ส่วน struct เป็น Value Type (copy ค่าจริงเมื่อส่งผ่านพารามิเตอร์)",
      "struct ไม่สามารถมี method ได้ ใช้ได้เฉพาะเก็บข้อมูลเท่านั้น",
      "ไม่มีความแตกต่างด้านพฤติกรรม ต่างกันแค่ตัวอักษรที่ใช้ประกาศ"
    ],
    answer: 1,
    explanation: "class เป็น Reference Type หมายความว่าตัวแปรเก็บ reference (ที่อยู่) ไปยัง object บน Heap ส่วน struct เป็น Value Type ที่เก็บค่าจริงอยู่ใน Stack เมื่อส่งผ่านฟังก์ชัน struct จะถูก copy ทั้งก้อน ทำให้เหมาะสำหรับข้อมูลขนาดเล็กที่ไม่ต้องการ reference semantics"
  }
];

// Share globally for our application
window.syntaxData = syntaxData;
window.visualizerData = visualizerData;
window.quizQuestions = quizQuestions;
console.log("SyntaxCraft Data successfully loaded.");
