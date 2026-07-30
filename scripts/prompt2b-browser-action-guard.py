#!/usr/bin/env python3
from pathlib import Path

path=Path('scripts/prompt2b-final-review.mjs')
source=path.read_text()

old="""const records=[];
const failures=[];
const screenshotManifest=[];
"""
new="""const records=[];
const failures=[];
const screenshotManifest=[];
const progressPath=path.join(output,'PROGRESS.json');
const writeProgress=async(payload)=>writeFile(progressPath,JSON.stringify({head,updatedAt:new Date().toISOString(),completedRecords:records.length,failures:failures.length,...payload},null,2)+'\\n');
"""
if old not in source: raise SystemExit('record declaration block not found')
source=source.replace(old,new,1)

old="""          for(const route of routes){
            const page=await context.newPage();
            const consoleErrors=[];const pageErrors=[];const failedResources=[];
"""
new="""          for(const route of routes){
            await writeProgress({phase:'attempting',browser:browserName,width,height,appearance:theme.label,persona:theme.persona,motion,route});
            const page=await context.newPage();
            const consoleErrors=[];const pageErrors=[];const failedResources=[];const actionErrors=[];
"""
if old not in source: raise SystemExit('route attempt block not found')
source=source.replace(old,new,1)

old="""            if(route==='calculator-center'){
              await page.locator('[data-action="calculate"]').click();
              await page.waitForFunction(()=>!document.querySelector('#result-primary')?.textContent?.includes('Ready for'),null,{timeout:10000});
            }
            if(route==='indicator-library'){
              await page.locator('[data-action="calculate"]').click();
              await page.waitForFunction(()=>document.querySelector('#indicator-primary')?.textContent!=='Ready',null,{timeout:10000});
            }
"""
new="""            if(route==='calculator-center'){
              try{
                const action=page.locator('[data-action="calculate"]');
                await action.waitFor({state:'visible',timeout:10000});
                if(!await action.isEnabled())throw new Error('Calculator action is disabled');
                const initial=await page.locator('#result-primary').textContent();
                await action.click();
                await page.waitForFunction((before)=>{
                  const element=document.querySelector('#result-primary');
                  const evidence=document.querySelector('#result-evidence');
                  return Boolean(element)&&element.textContent!==before&&!element.textContent.includes('Ready for')&&Boolean(evidence?.textContent?.trim());
                },initial,{timeout:10000});
              }catch(error){actionErrors.push({action:'calculator-calculate',name:error.name,message:error.message});}
            }
            if(route==='indicator-library'){
              try{
                const action=page.locator('[data-action="calculate"]');
                await action.waitFor({state:'visible',timeout:10000});
                if(!await action.isEnabled())throw new Error('Indicator action is disabled');
                const initial=await page.locator('#indicator-primary').textContent();
                await action.click();
                await page.waitForFunction((before)=>{
                  const element=document.querySelector('#indicator-primary');
                  return Boolean(element)&&element.textContent!==before&&element.textContent!=='Ready';
                },initial,{timeout:10000});
              }catch(error){actionErrors.push({action:'indicator-calculate',name:error.name,message:error.message});}
            }
"""
if old not in source: raise SystemExit('action block not found')
source=source.replace(old,new,1)

old="""            const record={browser:browserName,width,height,appearance:theme.label,persona:theme.persona,motion,route,loadMs:Number(loadMs.toFixed(2)),...metrics,navClearance,truth,consoleErrors,pageErrors,failedResources};
"""
new="""            const record={browser:browserName,width,height,appearance:theme.label,persona:theme.persona,motion,route,loadMs:Number(loadMs.toFixed(2)),...metrics,navClearance,truth,consoleErrors,pageErrors,failedResources,actionErrors};
"""
if old not in source: raise SystemExit('record object not found')
source=source.replace(old,new,1)

old="""            if(failedResources.length)reasons.push(`failed-local-resources:${failedResources.length}`);
            records.push(record);
"""
new="""            if(failedResources.length)reasons.push(`failed-local-resources:${failedResources.length}`);
            if(actionErrors.length)reasons.push(`action-errors:${actionErrors.length}`);
            records.push(record);
"""
if old not in source: raise SystemExit('failure reason block not found')
source=source.replace(old,new,1)

old="""            if(shouldCapture(browserName,width,theme.label,motion,route)||reasons.length){
              const name=`${browserName}-${route}-${width}x${height}-${theme.label}-${motion}.png`;
              await page.screenshot({path:path.join(screenshots,name),fullPage:false});
              const bytes=await readFile(path.join(screenshots,name));
              screenshotManifest.push({name,bytes:bytes.length,sha256:sha256(bytes),browser:browserName,route,width,height,appearance:theme.label,persona:theme.persona,motion,failure:reasons.length>0,reasons});
            }
            await page.close();
"""
new="""            if(shouldCapture(browserName,width,theme.label,motion,route)||reasons.length){
              const name=`${browserName}-${route}-${width}x${height}-${theme.label}-${motion}.png`;
              await page.screenshot({path:path.join(screenshots,name),fullPage:false});
              const bytes=await readFile(path.join(screenshots,name));
              screenshotManifest.push({name,bytes:bytes.length,sha256:sha256(bytes),browser:browserName,route,width,height,appearance:theme.label,persona:theme.persona,motion,failure:reasons.length>0,reasons});
            }
            await writeProgress({phase:'completed',browser:browserName,width,height,appearance:theme.label,persona:theme.persona,motion,route,reasons,actionErrors});
            await page.close();
"""
if old not in source: raise SystemExit('record completion block not found')
source=source.replace(old,new,1)

path.write_text(source)
print({'bytes':path.stat().st_size})
