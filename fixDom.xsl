<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:xs="http://www.w3.org/2001/XMLSchema"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xmlns:px="http://www.publishingx.de"
	exclude-result-prefixes="xs px xsi"
	version="2.0">
	
	<xsl:variable name="debug" select="false()" as="xs:boolean"/>
	
	<xsl:output method="xml" indent="yes"/>
	
	<!-- Copy all -->
	<xsl:template match="node()|@*" priority="-1">
		<xsl:copy exclude-result-prefixes="#all" inherit-namespaces="no" copy-namespaces="no">
			<xsl:apply-templates select="node()|@*"/>
		</xsl:copy>
	</xsl:template>	

	<xsl:template match="@href">
		<xsl:attribute name="href">
			<xsl:value-of select="replace(., '[#/]','')"/>
			<xsl:if test="ancestor::sui">
				<xsl:text>SUI</xsl:text>
			</xsl:if>
		</xsl:attribute>
	</xsl:template>
	
	<xsl:template match="classdef/@name">
		<xsl:attribute name="name">
			<xsl:value-of select="."/>
			<xsl:if test="ancestor::sui">
				<xsl:text>SUI</xsl:text>
			</xsl:if>
		</xsl:attribute>
	</xsl:template>

	
	<!-- Fix inconsistent Dom Structure -->
	<xsl:template match="datatype">
		<xsl:variable name="array" select="array"/>
		<xsl:variable name="datatypeNode" select="."/>
		<xsl:choose>
			<xsl:when test="starts-with(type, 'Measurement Unit (Number or String)=any')">
				<datatype>
					<type>Number</type>
					<is>Measurement Unit</is>
					<xsl:copy-of select="$array"/>
					<xsl:call-template name="checkForRange"/>
				</datatype>
				<datatype>
					<type>String</type>
					<is>Measurement Unit</is>
					<xsl:copy-of select="$array"/>
					<xsl:call-template name="checkForRange"/>
				</datatype>
			</xsl:when>
			
			<xsl:otherwise>
				<datatype>
					<xsl:apply-templates/>					
					<xsl:call-template name="checkForRange"/>
				</datatype>
			</xsl:otherwise>			
		</xsl:choose>
		<xsl:if test="preceding-sibling::shortdesc">
			<xsl:analyze-string select="preceding-sibling::shortdesc" regex="(Can also accept:|Can return:)(.*)$">
					<xsl:matching-substring>
						<xsl:if test="$debug">
							<xsl:comment>
								<xsl:value-of select="regex-group(2)"></xsl:value-of>
							</xsl:comment>
						</xsl:if>
						<xsl:for-each select="tokenize(px:cleanAcceptReturn(regex-group(2)), ',')">
							<xsl:sort/>
								<xsl:if test="replace(., '\s', '') != ''">								
									<datatype>
										<type>
											<xsl:value-of select="px:cleanTypeName(., $datatypeNode)"/>
										</type>						
										<xsl:if test="not(starts-with(px:cleanTypeName(., $datatypeNode), 'NothingEnum'))">
										<xsl:choose>
											<xsl:when test="$array">
												<xsl:copy-of select="$array"/>		
											</xsl:when>
											<xsl:when test="matches(., 'Array of')">
												<array/>
											</xsl:when>
										</xsl:choose>
										</xsl:if>										
										<xsl:call-template name="checkForRange">
											<xsl:with-param name="datatypeNode" select="$datatypeNode"/>
										</xsl:call-template>
									</datatype>									
								</xsl:if>
						</xsl:for-each>
					</xsl:matching-substring>
				</xsl:analyze-string>
		</xsl:if>
	</xsl:template>
	
	<!-- Fix parent Datatypes and rwAccess	-->
	<xsl:template match="property">
		<xsl:variable name="propertyNode" select="."/>
		<xsl:choose>
			<xsl:when test="@name='parent'">
				<property name="parent">
					<xsl:attribute name="rwaccess">readonly</xsl:attribute>
					<xsl:apply-templates select="shortdesc"></xsl:apply-templates>
					
										
					<xsl:analyze-string select="shortdesc" regex="^The parent.+?\(a (.+?)\)">
						<xsl:matching-substring>
							<xsl:if test="$debug">
								<xsl:comment>
									<xsl:value-of select="regex-group(1)"></xsl:value-of>
								</xsl:comment>
							</xsl:if>
							<xsl:for-each select="tokenize(replace(regex-group(1), ' or ', ','), ',')">
								<xsl:sort/>
								<datatype>
									<type>
										<xsl:value-of select="px:cleanTypeName(., $propertyNode)"/>
									</type>
								</datatype>									
							</xsl:for-each>
						</xsl:matching-substring>
					</xsl:analyze-string>

				</property>				
			</xsl:when>
			<xsl:otherwise>
				<property>
					<xsl:copy-of select="@*"/>
					<xsl:if test="not(@rwaccess)">
						<xsl:attribute name="rwaccess">read/write</xsl:attribute>
					</xsl:if>
					<xsl:apply-templates/>
				</property>				
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	
	
	<xsl:template name="checkForRange">
		<xsl:param name="datatypeNode" select="."/>
		<xsl:if test="not($datatypeNode/min and $datatypeNode/max) and $datatypeNode/preceding-sibling::shortdesc">
			<xsl:analyze-string select="$datatypeNode/preceding-sibling::shortdesc" regex="(range of|Range:) (\d+) to (\d+)">
				<xsl:matching-substring>
					<xsl:comment>
						<xsl:value-of select="."/>
					</xsl:comment>
					<min><xsl:value-of select="regex-group(2)"/></min>
					<max><xsl:value-of select="regex-group(3)"/></max>
				</xsl:matching-substring>
			</xsl:analyze-string>
		</xsl:if>
	</xsl:template>
	
	<xsl:template match="type">
		<type>
			<xsl:value-of select="px:cleanTypeName(text(), .)"/>
		</type>
	</xsl:template>

	<!-- Fix Type Names -->	
	<xsl:function name="px:cleanTypeName">		
		<xsl:param name="text"/>
		<xsl:param name="context"/>			
		<xsl:variable name="clean0">
			<xsl:value-of select="$text"/>
			<xsl:if test="$context/ancestor::sui and not(matches($text, '(object|string|bool|number|array|function|file|folder)', 'i'))">
				<xsl:text>SUI</xsl:text>
			</xsl:if>
		</xsl:variable>
		
		<xsl:choose>
			<xsl:when test="matches($clean0, 'Array')">
				<xsl:value-of select="replace($clean0, 'Array of ', '')"/>
			</xsl:when>
			<xsl:otherwise>
				<xsl:variable name="clean1" select="replace($clean0, 'enumerator', '')"/>
				<xsl:variable name="clean2" select="replace($clean1, '[\s.]', '')"/>
				<xsl:variable name="clean3" select="concat(upper-case(substring($clean2, 1, 1)), substring($clean2, 2))"/>
				<xsl:variable name="clean4" select="replace($clean3, 'Varies=any', 'Varies')"/>
				<xsl:variable name="clean5" select="replace($clean4, 'Any', 'Varies')"/>
				
				<xsl:variable name="clean98" select="replace($clean5, 'NothingEnumerat', 'NothingEnum')"/>
				<xsl:variable name="clean99" select="replace($clean98, 'Bool', 'Boolean')"/>
				<xsl:variable name="clean100" select="replace($clean99, 'Booleanean', 'Boolean')"/>
				<xsl:variable name="clean101" select="replace($clean100, 'SpecialCharacterss', 'SpecialCharacters')"/>
				<xsl:value-of select="$clean101"/>						
			</xsl:otherwise>
		</xsl:choose>
		
	</xsl:function>
	
	<xsl:function name="px:cleanAcceptReturn">		
		<xsl:param name="text"/>
		<xsl:variable name="clean0" select="$text"/>
		<xsl:variable name="clean1" select="replace($clean0, ' or ', ',')"/>
		<xsl:variable name="clean2" select="replace($clean1, 'Can also accept:', ',')"/>
		<xsl:value-of select="$clean2"/>		
	</xsl:function>
	
	
	
	
</xsl:stylesheet>