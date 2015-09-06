<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema" exclude-result-prefixes="xs" version="2.0">

  <xsl:output method="text"/>

  <xsl:template match="/">


    <xsl:variable name="completions">
<!--      
       <elements type="instance">
                  <method name="add">
      -->
      <xsl:for-each select="//elements[@type='instance']/method/@name">
        <xsl:element name="node">
          <xsl:value-of select="."/><xsl:text>()</xsl:text>
        </xsl:element>
      </xsl:for-each>
<!--      
      
                     <elements type="instance">
                  <property name="documentPath" rwaccess="readonly">
      -->
      <xsl:for-each select="//elements[@type='instance']/property/@name">
        <xsl:element name="node">
          <xsl:value-of select="."/>
        </xsl:element>
      </xsl:for-each>
      
<!--       <elements type="class">
                  <property name="BEFORE_PRINT" rwaccess="readonly">
      -->
      <xsl:for-each select="//indd//elements[@type='class']/property/@name">
        <xsl:element name="node">
          <xsl:value-of select="parent::property/parent::elements/parent::classdef/@name"/><xsl:text>.</xsl:text><xsl:value-of select="."/>
        </xsl:element>
      </xsl:for-each>
      
    </xsl:variable>

    <xsl:text>
{
  "scope":
  [
       "source.js",
       "source.jsx",
       "text.jsx"
  ],

  "completions":
  [
</xsl:text>

    <xsl:for-each select="distinct-values($completions/node)">
      <xsl:sort></xsl:sort>
      <xsl:text>    "</xsl:text>
      <xsl:value-of select="."/>
      <xsl:text>"</xsl:text>
      <xsl:if test="position() != last()">
        <xsl:text>,</xsl:text>
        <xsl:text>&#x0A;</xsl:text>
      </xsl:if>
    </xsl:for-each>

    <xsl:text>
    ]
}
</xsl:text>

  </xsl:template>
</xsl:stylesheet>
