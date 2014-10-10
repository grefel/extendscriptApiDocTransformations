# Adobe ExtendScript API Documentation 

This project contains the XSLT transformation files for creating a readable documentation of the Adobe ExtendScript APIs. The transformation is optimised for the InDesign DOM, but should work for other Adobe Extendscript DOMs as well. The files are transformed to [DITA](http://en.wikipedia.org/wiki/Darwin_Information_Typing_Architecture) XML data model. I found the intermediate format particularly helpful for validating all references. It could also used to add more help information via DITA Topics by your own. 
You can set up your own [DITA-OT Transformation](http://dita-ot.github.io/) to publish an output format of your like. I rendered a WebHelp Documentation with [oXygen DITA-OT Webhelp](http://www.oxygenxml.com/).

If you want to use the documentation you can find the most recent CC (Version 10) API on my site [www.indesignjs.de](http://www.indesignjs.de/extendscriptAPI/indesign10). For InDesign CS6 [goto](http://www.indesignjs.de/extendscriptAPI/indesign8).

There is also an alternative node.js approach on [github](https://github.com/yearbookmachine/extendscript-api-documentation) and a HTML compilation from [jongware](http://www.jongware.com/idjshelp.html).


### Before you start

  - Java and XSLT 2.0 Processor. For example [Saxon XSLT Processor](http://www.saxonica.com/welcome/welcome.xml)
  - Put the Adobe InDesign and ExtendScript Toolkit  source files in Folder `sourceXML`

#### XML file locations

The XML source files can be found in the following locations on Mac OS X. 

  - `/Library/Application Support/Adobe/Scripting Dictionaries CC/CommonFiles`
  - `~/Library/Preferences/ExtendScript Toolkit/4.0/omv$indesign-9.064$9.0.xml`

On Windows the Files are located at:

  - `\Users\[Username]\AppData\Roaming\Adobe\ExtendScript Toolkit\4.0\omv$indesign-10.064$10.0.xml`
  - `C:\Program Files (x86)\Common Files\Adobe\Scripting Dictionaries CC\CommonFiles\`
 
The copyright of the original Files is by <a href="http://www.adobe.com">Adobe Systems Incorporated</a>.

## XSLT Transformation

This basically a three step process:

1. Merge the Source files and get rid of namespace bugs with `mergeFiles.xslt`.  This transformation works with a named template (Saxon Option is '-it mergeDOMFiles'). You can change the path params in the file, or call the transformation with the path to indesign.xml, javascript.xml scriptui.xml.
2. Fix DOM Structure for further processing with `fixDom.xsl`. All ScriptUI classes are postfixed with `(SUI)`. Please note: There are some ugly hacks, basically replace() to get it working, probably some unrecognized bugs wil be produced. This file could also serve as a nice datasource for  Sublimetext Code Completion Files. 
3. Transform DOM Structure to DITA Topics and create a DITA Map with `dom2dita.xsl` You'll find the results in folder `domOut`

Please note: For a readable output format you've to set up an [DITA-OT Transformation](http://dita-ot.github.io/).

### License

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br /><span xmlns:dct="http://purl.org/dc/terms/" property="dct:title">ExtendScriptAPI</span> by <a xmlns:cc="http://creativecommons.org/ns#" href="http://www.publishingx.de/" property="cc:attributionName" rel="cc:attributionURL">Gregor Fellenz</a> is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.<br />Based on a work at <a xmlns:dct="http://purl.org/dc/terms/" href="http://www.adobe.com/" rel="dct:source">http://www.adobe.com/</a>.

### Acknowledgements
This project ist based on the fantastic ExtendScript API HTML from <a href="http://www.jongware.com/idjshelp.html">Theunis de Jong</a> aka Jongware. Without his efforts and inspiration I would not have realized it. Thank you!