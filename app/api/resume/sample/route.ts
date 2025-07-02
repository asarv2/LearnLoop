import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Hardcoded sample resume data for John Doe (from the PDF)
    const sampleResumeText = `John Doe
john.doe@example.com | (555) 123-4567 | LinkedIn: linkedin.com/in/johndoe

PROFESSIONAL SUMMARY
Experienced Mechanical Engineer with 5+ years of expertise in product design, manufacturing processes, and project management. Proven track record of developing innovative solutions for complex engineering challenges in the automotive and aerospace industries.

TECHNICAL SKILLS
• CAD Software: SolidWorks, AutoCAD, Fusion 360
• Analysis Tools: ANSYS, MATLAB, Simulink
• Manufacturing: CNC Machining, 3D Printing, Injection Molding
• Programming: Python, C++, LabVIEW
• Project Management: Agile, Six Sigma Green Belt

PROFESSIONAL EXPERIENCE

Senior Mechanical Engineer | TechCorp Industries | 2021 - Present
• Led design and development of automotive components, reducing production costs by 15%
• Managed cross-functional teams of 8+ engineers on multiple concurrent projects
• Implemented lean manufacturing principles, improving efficiency by 20%
• Collaborated with suppliers and vendors to optimize supply chain processes

Mechanical Engineer | InnovateMech Solutions | 2019 - 2021
• Designed and tested mechanical systems for aerospace applications
• Conducted finite element analysis and thermal simulations
• Prepared technical documentation and reports for regulatory compliance
• Mentored junior engineers and interns

EDUCATION
Bachelor of Science in Mechanical Engineering
State University | 2019
GPA: 3.7/4.0

CERTIFICATIONS
• Professional Engineer (PE) License
• Six Sigma Green Belt
• SOLIDWORKS Certified Professional (CSWP)

PROJECTS
• Autonomous Vehicle Suspension System: Designed innovative suspension system improving ride comfort by 25%
• Drone Propulsion Optimization: Developed more efficient propeller design increasing flight time by 18%`;

    const resumeData = {
      text: sampleResumeText,
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '(555) 123-4567',
      skills: ['SolidWorks', 'AutoCAD', 'ANSYS', 'MATLAB', 'Python', 'C++', 'CNC Machining', '3D Printing'],
      experience: ['Senior Mechanical Engineer at TechCorp Industries', 'Mechanical Engineer at InnovateMech Solutions']
    };

    const formattedText = `CANDIDATE RESUME

Name: John Doe
Email: john.doe@example.com
Phone: (555) 123-4567

--- FULL RESUME CONTENT ---

${sampleResumeText}`;
    
    return NextResponse.json({
      success: true,
      resumeData,
      formattedText,
      candidateName: 'John Doe'
    });
    
  } catch (error) {
    console.error('Error loading sample resume:', error);
    return NextResponse.json(
      { error: 'Failed to load sample resume' },
      { status: 500 }
    );
  }
} 