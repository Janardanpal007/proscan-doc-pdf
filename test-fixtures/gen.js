const fs=require('fs');
const path=require('path');
const NM=path.resolve(__dirname,'../../node_modules');
const docx=require(NM+'/docx');
const XLSX=require(NM+'/xlsx');
const {jsPDF}=require(NM+'/jspdf');
const PptxGenJS=require('pptxgenjs');
(async()=>{
 const d=new docx.Document({sections:[{children:[
  new docx.Paragraph({heading:docx.HeadingLevel.HEADING_1,children:[new docx.TextRun('ProScan Test Report')]}),
  new docx.Paragraph({children:[new docx.TextRun({text:'Bold intro. ',bold:true}),new docx.TextRun('This document verifies Word to PDF conversion with headings, paragraphs and a table.')]}),
  ...Array.from({length:60},(_,i)=>new docx.Paragraph('Paragraph line number '+(i+1)+' — lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.')),
  new docx.Table({rows:[['Item','Qty','Price'],['Apples','3','$4.50'],['Pears','5','$6.00']].map(r=>new docx.TableRow({children:r.map(c=>new docx.TableCell({children:[new docx.Paragraph(c)]}))}))}),
 ]}]});
 fs.writeFileSync('report.docx',await docx.Packer.toBuffer(d));
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Name','Region','Q1','Q2','Q3','Q4'],...Array.from({length:40},(_,i)=>['Person '+(i+1),['North','South','East','West'][i%4],i*10,i*12,i*7,i*3])]),'Sales');
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Metric','Value'],['Total','12,345'],['Growth','8%']]),'Summary');
 XLSX.writeFile(wb,'sales.xlsx');
 const p=new PptxGenJS();
 let s=p.addSlide(); s.background={color:'1E1E2E'}; s.addText('ProScan Deck',{x:0.5,y:1.5,w:9,h:1.2,fontSize:44,bold:true,color:'C6FF3D',align:'center'}); s.addText('Slide conversion test',{x:0.5,y:2.8,w:9,h:0.6,fontSize:20,color:'FFFFFF',align:'center'});
 s=p.addSlide(); s.addText('Agenda',{x:0.5,y:0.3,w:9,h:0.8,fontSize:32,bold:true,color:'2F5BEA'}); s.addText([{text:'Scan documents',options:{bullet:true}},{text:'Convert formats',options:{bullet:true}},{text:'Edit and sign',options:{bullet:true}}],{x:0.7,y:1.3,w:8,h:2.5,fontSize:22,color:'333333'}); s.addShape(p.ShapeType.rect,{x:6.5,y:3.6,w:3,h:1.4,fill:{color:'FF4FD8'}});
 s=p.addSlide(); s.addTable([[{text:'Plan'},{text:'Price'}],['Free','$0'],['Pro','$5']],{x:1,y:1,w:6,fontSize:18,border:{color:'999999',pt:1}});
 await p.writeFile({fileName:'deck.pptx'});
 const pdf=new jsPDF({unit:'pt',format:'a4'});
 for(let i=1;i<=5;i++){ if(i>1) pdf.addPage(); pdf.setFontSize(28); pdf.text('Test PDF page '+i,60,90); pdf.setFontSize(12); for(let l=0;l<30;l++) pdf.text('This is line '+(l+1)+' of page '+i+'. ProScan should extract this text into Word.',60,140+l*20); }
 fs.writeFileSync('sample.pdf',Buffer.from(pdf.output('arraybuffer')));
 console.log(fs.readdirSync('.').filter(f=>/\.(docx|xlsx|pptx|pdf)$/.test(f)).map(f=>f+' '+fs.statSync(f).size).join('\n'));
})();
