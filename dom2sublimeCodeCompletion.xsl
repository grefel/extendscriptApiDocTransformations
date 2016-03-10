<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema" exclude-result-prefixes="xs" version="2.0">

  <xsl:output method="text"/>

  <xsl:template match="/">


    <xsl:variable name="completions">
      <!--      <elements type="instance">
          <method name="add"> -->
      <xsl:for-each select="//elements/method/@name">
        <xsl:element name="node">
          <xsl:choose>
            <xsl:when test="parent::method/parent::elements/parent::classdef/@name = '$'">
              <xsl:text>$.</xsl:text>
              <xsl:value-of select="."/>              
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="."/>
            </xsl:otherwise>
          </xsl:choose>
          <xsl:text>()</xsl:text>
        </xsl:element>
      </xsl:for-each>
      <!--      <elements type="instance">
          <property name="documentPath" rwaccess="readonly">  -->
      <xsl:for-each select="//elements/property/@name">
        <xsl:if test="string-length(.) > 1">
          <xsl:element name="node">
            <xsl:choose>
              <xsl:when test="parent::property/parent::elements/@type = 'class' and ancestor::indd">
                <xsl:value-of select="parent::property/parent::elements/parent::classdef/@name"/>
                <xsl:text>.</xsl:text>
                <xsl:value-of select="."/>
              </xsl:when>
              <xsl:otherwise>
                <xsl:value-of select="."/>
              </xsl:otherwise>
            </xsl:choose>

          </xsl:element>
        </xsl:if>
      </xsl:for-each>


    </xsl:variable>

    <xsl:text>
{
&#x09;"scope":
&#x09;[
&#x09;&#x09;"source.js",
&#x09;&#x09;"source.jsx",
&#x09;&#x09;"text.jsx"
&#x09;],

&#x09;"completions":
&#x09;[
</xsl:text>

    <xsl:for-each select="distinct-values($completions/node)">
      <xsl:sort/>
      <xsl:text>&#x09;&#x09;"</xsl:text>
      <xsl:value-of select="replace(., '\$', '\\\\\$')"/>
      <xsl:text>"</xsl:text>
      <!--      <xsl:if test="position() != last()">
-->
      <xsl:text>,</xsl:text>
      <xsl:text>&#x0A;</xsl:text>
      <!--</xsl:if>-->
    </xsl:for-each>

    <xsl:text>
&#x09;&#x09;"#targetengine",
&#x09;&#x09;"#target",
&#x09;&#x09;"null",
&#x09;&#x09;"true",
&#x09;&#x09;"false",
&#x09;&#x09;"function ()",
&#x09;&#x09;"break;",
&#x09;&#x09;"case",
&#x09;&#x09;"catch",
&#x09;&#x09;"const",
&#x09;&#x09;"continue;",
&#x09;&#x09;"delete",
&#x09;&#x09;"do",
&#x09;&#x09;"else",
&#x09;&#x09;"export",
&#x09;&#x09;"extends",
&#x09;&#x09;"finally",
&#x09;&#x09;"for (var i = 0; i &lt; Object; i++) {",
&#x09;&#x09;"if () {",
&#x09;&#x09;"import",
&#x09;&#x09;"in",
&#x09;&#x09;"instanceof",
&#x09;&#x09;"let",
&#x09;&#x09;"new",
&#x09;&#x09;"return",
&#x09;&#x09;"super",
&#x09;&#x09;"switch",
&#x09;&#x09;"this",
&#x09;&#x09;"throw",
&#x09;&#x09;"try",
&#x09;&#x09;"typeof",
&#x09;&#x09;"var",
&#x09;&#x09;"void",
&#x09;&#x09;"while ()",
&#x09;&#x09;"with",
&#x09;&#x09;"/**/",
&#x09;]
}
</xsl:text>

  </xsl:template>
</xsl:stylesheet>
