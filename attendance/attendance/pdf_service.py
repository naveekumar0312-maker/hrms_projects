import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

def generate_attendance_pdf_bytes(report_data):
    """
    Generate a polished, professional A4 attendance PDF report using ReportLab.
    report_data is a dict containing:
      - 'employee': {'id', 'name', 'employee_id', 'department', 'designation', 'branch', 'shift', 'phone_number'}
      - 'month_name': str
      - 'year': int
      - 'summary': dict of summary counters
      - 'days': list of daily attendance objects
      - 'company_name': str
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    primary_color = colors.HexColor('#0F172A')
    brand_emerald = colors.HexColor('#059669')
    slate_600 = colors.HexColor('#475569')
    slate_100 = colors.HexColor('#F1F5F9')

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=primary_color,
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=slate_600,
    )
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=brand_emerald,
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=primary_color,
    )
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=1, # Center
    )
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=primary_color,
        alignment=1, # Center
    )
    table_cell_left = ParagraphStyle(
        'TableCellLeft',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=primary_color,
        alignment=0, # Left
    )

    elements = []

    # 1. Header with Company & Document Title
    emp = report_data.get('employee', {})
    company_name = report_data.get('company_name') or 'HRMS Yaazh360'
    month_name = report_data.get('month_name', '')
    year = report_data.get('year', '')

    header_table_data = [
        [
            Paragraph(f"<b>{company_name}</b>", title_style),
            Paragraph(f"<b>MONTHLY ATTENDANCE REPORT</b><br/>Cycle: {month_name} {year}", subtitle_style)
        ]
    ]
    header_table = Table(header_table_data, colWidths=[300, 222])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 10))

    # 2. Employee Info & Cycle Info Card
    emp_info_data = [
        [
            Paragraph(f"<b>Employee Name:</b> {emp.get('name') or emp.get('full_name') or '--'}", body_style),
            Paragraph(f"<b>Employee ID:</b> {emp.get('employee_id') or '--'}", body_style),
        ],
        [
            Paragraph(f"<b>Department:</b> {emp.get('department') or '--'}", body_style),
            Paragraph(f"<b>Designation:</b> {emp.get('designation') or '--'}", body_style),
        ],
        [
            Paragraph(f"<b>Branch:</b> {emp.get('branch') or '--'}", body_style),
            Paragraph(f"<b>Phone:</b> {emp.get('phone_number') or emp.get('phone') or '--'}", body_style),
        ]
    ]
    emp_table = Table(emp_info_data, colWidths=[261, 261])
    emp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), slate_100),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(emp_table)
    elements.append(Spacer(1, 14))

    # 3. Monthly Metrics Summary Grid
    summary = report_data.get('summary', {})
    
    # Calculate duration strings
    tot_work_mins = summary.get('total_working_minutes', 0)
    work_hrs_str = f"{tot_work_mins // 60}h {tot_work_mins % 60}m"
    
    late_mins = summary.get('total_late_minutes', 0)
    late_hrs_str = f"{late_mins // 60}h {late_mins % 60}m" if late_mins else "0m"

    perm_used_mins = summary.get('approved_permission_minutes', 0)
    perm_str = f"{perm_used_mins // 60}h {perm_used_mins % 60}m" if perm_used_mins else "0m"

    summary_grid_data = [
        [
            Paragraph(f"<b>Present Days</b><br/><font size='12' color='#16A34A'><b>{summary.get('present', 0)}</b></font>", body_style),
            Paragraph(f"<b>Absent Days</b><br/><font size='12' color='#DC2626'><b>{summary.get('absent', 0)}</b></font>", body_style),
            Paragraph(f"<b>Late Days</b><br/><font size='12' color='#D97706'><b>{summary.get('late_days', 0)}</b> ({late_hrs_str})</font>", body_style),
            Paragraph(f"<b>Holidays</b><br/><font size='12' color='#0284C7'><b>{summary.get('holidays', 0)}</b></font>", body_style),
        ],
        [
            Paragraph(f"<b>Total Working Time</b><br/><font size='11' color='#0F172A'><b>{work_hrs_str}</b></font>", body_style),
            Paragraph(f"<b>Permissions Used</b><br/><font size='11' color='#7C3AED'><b>{perm_str}</b></font>", body_style),
            Paragraph(f"<b>Grace Count</b><br/><font size='11' color='#059669'><b>{summary.get('grace_used_count', 0)} / 3</b></font>", body_style),
            Paragraph(f"<b>Overtime Days</b><br/><font size='11' color='#0F172A'><b>{summary.get('overtime_days', 0)}</b></font>", body_style),
        ]
    ]
    summary_table = Table(summary_grid_data, colWidths=[130.5, 130.5, 130.5, 130.5])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 14))

    # 4. Daily Attendance Table
    elements.append(Paragraph("<b>Daily Attendance Records</b>", section_title_style))
    elements.append(Spacer(1, 6))

    table_data = [
        [
            Paragraph("<b>Date</b>", table_header_style),
            Paragraph("<b>Day</b>", table_header_style),
            Paragraph("<b>Status</b>", table_header_style),
            Paragraph("<b>Check In</b>", table_header_style),
            Paragraph("<b>Check Out</b>", table_header_style),
            Paragraph("<b>Hours</b>", table_header_style),
            Paragraph("<b>Remarks / Notes</b>", table_header_style),
        ]
    ]

    days = report_data.get('days', [])
    for d in days:
        d_date_str = d.get('date', '')
        day_name = ''
        if d_date_str:
            try:
                dt_obj = datetime.strptime(d_date_str, '%Y-%m-%d')
                day_name = dt_obj.strftime('%a')
            except Exception:
                pass

        status_raw = d.get('status', '--')
        status_disp = status_raw.replace('_', ' ').title()
        
        # Color coding status text
        if 'Present' in status_disp or status_raw == 'ON_TIME':
            status_html = f"<font color='#16A34A'><b>{status_disp}</b></font>"
        elif 'Absent' in status_disp:
            status_html = f"<font color='#DC2626'><b>{status_disp}</b></font>"
        elif 'Late' in status_disp:
            status_html = f"<font color='#D97706'><b>{status_disp}</b></font>"
        elif 'Weekend' in status_disp:
            status_html = f"<font color='#D97706'><b>Weekend</b></font>"
        elif 'Holiday' in status_disp:
            status_html = f"<font color='#0284C7'><b>Holiday</b></font>"
        elif 'Leave' in status_disp:
            status_html = f"<font color='#7C3AED'><b>{status_disp}</b></font>"
        else:
            status_html = status_disp

        # Formatting times (Check In & Check Out) to 12-hour AM/PM format
        cin = d.get('check_in') or d.get('check_in_time')
        cout = d.get('check_out') or d.get('check_out_time')
        cin_str = '--'
        cout_str = '--'
        if cin:
            try:
                # Handle iso string or HH:MM:SS
                if 'T' in cin:
                    dt = datetime.fromisoformat(cin.replace('Z', '+00:00'))
                    cin_str = dt.strftime('%I:%M %p')
                elif len(cin.split(':')) >= 2:
                    parts = cin.split(':')
                    h, m = int(parts[0]), int(parts[1])
                    ampm = 'PM' if h >= 12 else 'AM'
                    cin_str = f"{(h % 12) or 12:02d}:{m:02d} {ampm}"
            except Exception:
                cin_str = str(cin)[:5]

        if cout:
            try:
                if 'T' in cout:
                    dt = datetime.fromisoformat(cout.replace('Z', '+00:00'))
                    cout_str = dt.strftime('%I:%M %p')
                elif len(cout.split(':')) >= 2:
                    parts = cout.split(':')
                    h, m = int(parts[0]), int(parts[1])
                    ampm = 'PM' if h >= 12 else 'AM'
                    cout_str = f"{(h % 12) or 12:02d}:{m:02d} {ampm}"
            except Exception:
                cout_str = str(cout)[:5]

        # Working hours
        work_mins = d.get('working_minutes', 0)
        wh_str = f"{work_mins // 60}h {work_mins % 60}m" if work_mins else (d.get('working_hours') or '--')

        # Remarks / notes
        remarks = []
        if d.get('late_minutes', 0) > 0:
            remarks.append(f"Late by {d.get('late_minutes')}m")
        if d.get('holiday_name'):
            remarks.append(d.get('holiday_name'))
        if d.get('early_minutes', 0) > 0:
            remarks.append(f"Early {d.get('early_minutes')}m")
        if d.get('overtime_minutes', 0) > 0:
            remarks.append(f"OT {d.get('overtime_minutes')}m")
        remarks_str = ", ".join(remarks) if remarks else '-'

        table_data.append([
            Paragraph(d_date_str, table_cell_style),
            Paragraph(day_name, table_cell_style),
            Paragraph(status_html, table_cell_style),
            Paragraph(cin_str, table_cell_style),
            Paragraph(cout_str, table_cell_style),
            Paragraph(wh_str, table_cell_style),
            Paragraph(remarks_str, table_cell_left),
        ])

    daily_table = Table(
        table_data,
        colWidths=[65, 38, 78, 62, 62, 55, 162],
        repeatRows=1
    )
    daily_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(daily_table)

    # 5. Footer info
    elements.append(Spacer(1, 14))
    footer_text = f"Report generated on {datetime.now().strftime('%d %b %Y, %I:%M %p')} • HRMS Yaazh360 Confidential Attendance Record"
    elements.append(Paragraph(f"<font color='#94A3B8' size='7'>{footer_text}</font>", subtitle_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
