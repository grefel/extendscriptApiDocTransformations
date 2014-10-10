# Adobe ExtendScript API Documentation 

This project contains the XSLT transformation files for creating a readabel documentation for the Adobe ExtendScript APIs. The files are optimizesd for the InDesign DOM but should work for other programs as well. The files are transformed to [DITA](http://en.wikipedia.org/wiki/Darwin_Information_Typing_Architecture), for further processing. You can set up your own [DITA-OT Transformation](http://dita-ot.github.io/). I rendered a WebHelp Documentation with [oXygen DITA-OT Webhelp](http://www.oxygenxml.com/)

If you want to use the documentation you can find an online version [here](http://www.indesignjs.de/extendscriptAPI).

## Prerequisites

  - Java and XSLT 2.0 Processor. For example [Saxon XSLT Processor](http://www.saxonica.com/welcome/welcome.xml)
  - Adobe InDesign and ExtendScript Toolkit for XML source files in Folder `sourceXML`

### XML file locations

The XML source files can be found in the following locations on Mac OS X. 

  - `/Library/Application Support/Adobe/Scripting Dictionaries CC/CommonFiles`
  - `~/Library/Preferences/ExtendScript Toolkit/4.0/omv$indesign-9.064$9.0.xml`

On Windows the Files are located at:

  - `\Users\[Username]\AppData\Roaming\Adobe\ExtendScript Toolkit\4.0\omv$indesign-10.064$10.0.xml`
  - `C:\Program Files (x86)\Common Files\Adobe\Scripting Dictionaries CC\CommonFiles\`
 
## XSLT Transformation
This basically a three step process:



1. Merge the Source files and get rid of namespace bugs with `mergeFiles.xslt`
2. Fix DOM Structure for further processing with `mergeFiles.xslt`
3. Transform DOM Structure to DITA Topics and create a DITA Map with `dom2dita.xsl`



# License

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br /><span xmlns:dct="http://purl.org/dc/terms/" property="dct:title">ExtendScriptAPI</span> by <a xmlns:cc="http://creativecommons.org/ns#" href="http://www.publishingx.de/" property="cc:attributionName" rel="cc:attributionURL">Gregor Fellenz</a> is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.<br />Based on a work at <a xmlns:dct="http://purl.org/dc/terms/" href="http://www.adobe.com/" rel="dct:source">http://www.adobe.com/</a>.
