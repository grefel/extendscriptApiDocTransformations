<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:px="http://www.publishingx.de"
	exclude-result-prefixes="xs px" version="2.0">

	<xsl:param name="debug" select="false()" as="xs:boolean"/>
	<xsl:param name="allOut" select="true()" as="xs:boolean"/>

	<!-- Keys for Linking Classes -->
	<xsl:key name="className" match="classdef" use="@name"/>
	<xsl:key name="properties" match="property" use="datatype/type"/>
	<xsl:key name="retunrValues" match="method" use="datatype/type"/>
	

	
	<!-- Root -->
	<xsl:template match="/">
		<xsl:apply-templates select="//classdef"/>

		<xsl:variable name="outPath" select="concat('extendScriptAPI', '.ditamap')"/>
		<xsl:result-document href="{$outPath}" doctype-public="-//OASIS//DTD DITA Map//EN"
			doctype-system="map.dtd" indent="yes">
			<xsl:element name="map">
				<title>InDesign ExtendScript API <xsl:value-of select="replace(/domRoot/indd/dictionary/map/@title, '.*?(\(\d+\.\d+\)).*', '$1')"></xsl:value-of></title>
				<topichead navtitle="About">
					<topicref href="about.dita"/>						
				</topichead>
				<topichead>
					<xsl:attribute name="navtitle" select="/domRoot/indd/dictionary/map/@title"/>
					
					<!-- Mini Hierarchy-->
					<topicref href="Application.dita">							
						<topicref href="Document.dita">
							<topicref href="Page.dita">
								<topicref href="PageItem.dita">
									<topicref href="Graphic.dita">
										<!--...-->
									</topicref>									
								</topicref>
								<topicref href="TextFrame.dita">
									<topicref href="Story.dita">
										<topicref href="Paragraph.dita">
											<topicref href="ParagraphStyle.dita"/>
											<topicref href="Character.dita">
												<topicref href="CharacterStyle.dita"/>
											</topicref>
										</topicref>
										<topicref href="Table.dita">
											<topicref href="TableStyle.dita"/>
											<topicref href="Row.dita">
												<topicref href="Cell.dita">
													<topicref href="CellStyle.dita"/>
												</topicref>																					
											</topicref>																				
										</topicref>									
									</topicref>
								</topicref>							
							</topicref>							
							<topicref href="Link.dita">
								<!--...-->
							</topicref>
						</topicref>
					</topicref>
					
					<xsl:if test="$allOut">
						<xsl:apply-templates select="/domRoot/indd/dictionary/map"/>
					</xsl:if>
				</topichead>

				<xsl:if test="$allOut">
					<xsl:apply-templates select="/domRoot/js/dictionary/map"/>
					<xsl:apply-templates select="/domRoot/sui/dictionary/map"/>
				</xsl:if>
			</xsl:element>
		</xsl:result-document>
	</xsl:template>

	<!-- Building the Map/Hierarchy-->
	<xsl:template match="map">
		<xsl:apply-templates/>
	</xsl:template>

	<xsl:template match="topicref">
		<xsl:element name="topichead">
			<xsl:attribute name="navtitle" select="@navtitle"/>
			<xsl:apply-templates/>
		</xsl:element>
	</xsl:template>

	<xsl:template match="topicref/topicref">
		<xsl:element name="topicref">
			<xsl:attribute name="href" select="concat(@href, '.dita')"/>
			<xsl:apply-templates/>
		</xsl:element>
	</xsl:template>

	<!-- Processing Classes 	-->
	<xsl:template match="classdef">
		<xsl:variable name="classdefID" select="generate-id(.)"/>
		<xsl:variable name="className" select="@name"/>
		<xsl:variable name="outPath" select="concat($className, '.dita')"/>
		
		<xsl:result-document href="{$outPath}" doctype-public="-//OASIS//DTD DITA Topic//EN" doctype-system="topic.dtd" indent="yes">
			
			<topic id="{$classdefID}">
				<title><keyword><xsl:value-of select="px:fixSUI($className)"/></keyword></title>
				<body>
					<xsl:apply-templates select="description | shortdesc"/>
					<p outputclass="quicklinks"><indexterm><xsl:value-of select="$className"/></indexterm>
						<xsl:if test="not(@enumeration='true')">
							<xsl:text>Go to </xsl:text>
							<xsl:if test="elements/property">
								<b><xref href="{concat('#', $classdefID, '/iProps')}">Property Listing</xref></b>	
							</xsl:if>
							<xsl:if test="elements/method and elements/property">
								<xsl:text> | </xsl:text>
							</xsl:if>						
							<xsl:if test="elements/method">
								<b><xref href="{concat('#', $classdefID, '/iMethods')}">Method Listing</xref></b>					
							</xsl:if>
						</xsl:if>
					</p>
					<!--Generating Method Quicklinks-->
					<xsl:if test="elements/method">
						<section>
						<title>Methods:</title>
						<p>
							<xsl:for-each select="elements/method">
								<xsl:text> </xsl:text>
								<xref href="{concat('#', $classdefID, '/', generate-id(.))}">
									<xsl:value-of select="@name"/>
								</xref>
								<xsl:if test="position() != last()">
									<xsl:text>, </xsl:text>
								</xsl:if>
								
							</xsl:for-each>
						</p>
						</section>
					</xsl:if>
					<!--Generating Object Quicklinks-->
					<xsl:if test="elements[@type='instance']/property and not(px:isCollection($className))">
						<section>
						<title>Objects:</title>
						<p>
							<xsl:for-each-group select="elements[@type='instance']/property/datatype" group-by="type">
								<xsl:sort select="type"/>
								<xsl:if test="$debug">
									<xsl:comment>
										<xsl:value-of select="concat('|',datatype/type/text(),'|')"/>
									</xsl:comment>
								</xsl:if>
								<xsl:if test="current-group()[1]/type != 'Varies'">
									<xsl:call-template name="linkToClassName">
										<xsl:with-param name="writeFails" select="$debug"/>
										<xsl:with-param name="typeName" select="current-group()[1]/type"/>
										<xsl:with-param name="writeSeparator">
											<xsl:choose>
												<xsl:when test="position() != last()">
													<xsl:value-of select="true()"></xsl:value-of>
												</xsl:when>
												<xsl:otherwise>
													<xsl:value-of select="false()"></xsl:value-of>
												</xsl:otherwise>
											</xsl:choose>
										</xsl:with-param>
									</xsl:call-template>
								</xsl:if>
							</xsl:for-each-group>
						</p>
						</section>
					</xsl:if>
					<!-- Link to Superclass -->					
					<xsl:if test="superclass">
						<section>
						<title>Superclass:</title>
						<p>
							<xsl:call-template name="linkToClassName">
								<xsl:with-param name="typeName" select="superclass"/>
							</xsl:call-template>
						</p>
						</section>
					</xsl:if>

					<!--Generating Property Table-->
					<xsl:choose>
						<!--Eumeration-->
						<xsl:when test="@enumeration='true'">
							<section id="iProps">
								<title>Values</title>
								<table frame="all" rowsep="1" colsep="1">
									<tgroup cols="3">
										<colspec colname="c1" colnum="1" colwidth="0.2*"/>
										<colspec colname="c2" colnum="2" colwidth="0.7*"/>
										<colspec colname="c3" colnum="3" colwidth="0.1*"/>
										<thead>
											<row>
												<entry><p>Name</p></entry>
												<entry><p>Description</p></entry>
												<entry><p>Value</p></entry>
											</row>
										</thead>
										<tbody>
											<xsl:for-each select="elements[@type='class']/property">
												<xsl:sort select="@name"/>
												<row>
													<entry><p><xsl:value-of select="@name"/></p></entry>
													<entry>
														<xsl:apply-templates select="description | shortdesc"/>														
													</entry>
													<entry><p><xsl:value-of select="datatype/value"/></p></entry>
												</row>
											</xsl:for-each>
										</tbody>
									</tgroup>
								</table>
							</section>
						</xsl:when>
						<!--Class Properties--> 
						<xsl:otherwise>
							<xsl:if test="elements[@type='instance']/property">
								<section id="iProps">
									<title>Property Listing</title>
									<table frame="all" rowsep="1" colsep="1">
										<tgroup cols="4">
											<colspec colname="c1" colnum="1" colwidth="0.2*"/>
											<colspec colname="c2" colnum="2" colwidth="0.1*"/>
											<colspec colname="c3" colnum="3" colwidth="0.1*"/>
											<colspec colname="c4" colnum="4" colwidth="0.6*"/>
											<thead>
												<row>
													<entry><p>Property</p></entry>
													<entry><p>Type</p></entry>
													<entry><p>Access</p></entry>
													<entry><p>Description</p></entry>
												</row>
											</thead>
											<tbody>
												<xsl:for-each select="elements[@type='instance']/property">
													<xsl:sort select="@name"/>
													<xsl:apply-templates  select="." mode="Property"/>
												</xsl:for-each>
											</tbody>
										</tgroup>
									</table>
								</section>
							</xsl:if>

							<xsl:if test="elements[@type='class']/property">
								<section>
									<xsl:choose>
										<xsl:when test="ancestor::sui or ancestor::js">
											<title>Property Listing</title>											
										</xsl:when>
										<xsl:otherwise>
											<title>Constants/Events</title>
										</xsl:otherwise>
									</xsl:choose>
									<table frame="all" rowsep="1" colsep="1">
										<tgroup cols="4">
											<colspec colname="c1" colnum="1" colwidth="0.2*"/>
											<colspec colname="c2" colnum="2" colwidth="0.1*"/>
											<colspec colname="c3" colnum="3" colwidth="0.1*"/>
											<colspec colname="c4" colnum="4" colwidth="0.6*"/>
											<thead>
												<row>
													<entry><p>Name</p></entry>
													<entry><p>Type</p></entry>
													<entry><p>Access</p></entry>
													<entry><p>Description</p></entry>
												</row>
											</thead>
											<tbody>
												<xsl:for-each select="elements[@type='class']/property">
													<xsl:sort select="@name"/>
													<xsl:apply-templates select="." mode="Constant"/>
												</xsl:for-each>
											</tbody>
										</tgroup>
									</table>
								</section>
							</xsl:if>

							<xsl:if test="elements/method">
								<section id="iMethods">
									<title>Method Listing</title>
									<xsl:for-each select="elements[@type='constructor']/method">
										<xsl:sort select="@name"/>
										<p outputclass="noMarginConstructor"><b>Constructor</b></p>
										<xsl:apply-templates select="."/>
									</xsl:for-each>
									<xsl:for-each select="elements[not(@type='constructor')]/method">
										<xsl:sort select="@name"/>
										<xsl:apply-templates select="."/>
									</xsl:for-each>
								</section>
							</xsl:if>

						</xsl:otherwise>
					</xsl:choose>

					<!--Creating Links to Properties with this object-->
					<xsl:if test="key('properties', $className) and not(matches($className, '^(object|string|bool|number|array|function|file|folder|date|reflection)', 'i'))">
					<section>
						<title>Object of</title>
						<xsl:for-each select="key('properties', $className)">
							<xsl:sort/>
							<p outputclass="noMargin">
								<xsl:call-template name="generatClassLink">
									<xsl:with-param name="typeName" select="parent::elements/parent::classdef/@name"/> 
								</xsl:call-template>
								<xsl:text>.</xsl:text>
								<xsl:value-of select="@name"></xsl:value-of>
							</p>
						</xsl:for-each>
					</section>
					</xsl:if>
					
					<!--Creating Links to Methods with this object-->
					<xsl:if test="key('retunrValues', $className) and not(matches($className, '^(object|string|bool|number|array|function|file|folder|date|reflection)', 'i'))">
					<section>
						<title>Return</title>
						<xsl:for-each select="key('retunrValues', $className)">
							<xsl:sort/>
							<xsl:variable name="destinationClassdef" select="parent::elements/parent::classdef/@name"></xsl:variable>
							<p outputclass="noMargin">
								<xsl:call-template name="generatClassLink">
									<xsl:with-param name="typeName" select="$destinationClassdef"/>
									<xsl:with-param name="createShortcut" select="false()"/>
								</xsl:call-template>
								<xsl:text>.</xsl:text>
								<xref href="{concat($destinationClassdef, '.dita#', generate-id(key('className', $destinationClassdef)) ,'/',generate-id(.))}">
									<xsl:value-of select="@name"/>
								</xref>
								<xsl:text>()</xsl:text>
							</p>
					</xsl:for-each>
					</section>
					</xsl:if>
				</body>
			</topic>
		</xsl:result-document>
	</xsl:template>

	<!-- Processing Events and Constants	-->
	<xsl:template match="property" mode="Constant">
		<row>
			<entry><p><xsl:value-of select="@name"/></p></entry>
			<entry>
				<xsl:apply-templates select="datatype"/>
			</entry>
			<entry><p>readonly</p></entry>
			<entry>
				<xsl:apply-templates select="description | shortdesc"/>
			</entry>
		</row>

	</xsl:template>
	<!-- Processing Properties 	-->
	<xsl:template match="property" mode="Property">
		<xsl:element name="row">
			<entry>
				<p><xsl:value-of select="@name"/></p>
			</entry>
			<entry>
				<xsl:apply-templates select="datatype"/>
			</entry>
			<entry>
				<p>
					<xsl:value-of select="@rwaccess"/>
				</p>
			</entry>
			<entry>
				<xsl:apply-templates select="description | shortdesc"/>
			</entry>
		</xsl:element>
	</xsl:template>
	<!-- Processing Methods -->
	<xsl:template match="method">
		<p outputclass="methodName" id="{generate-id(.)}">
			<!-- Return value -->
			
			<xsl:choose>
				<xsl:when test="datatype">
					<xsl:call-template name="generatClassLink">
						<xsl:with-param name="typeName" select="datatype/type/text()"/>
						<xsl:with-param name="createShortcut" select="false()"></xsl:with-param>
					</xsl:call-template>
				</xsl:when>
				<xsl:otherwise>
					<xsl:text>undefined</xsl:text>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:text> </xsl:text>
			
			<!-- Function Name -->
			<xsl:if test="$debug">
				<xsl:message select="@name"/>
			</xsl:if>
			<b><xsl:apply-templates select="@name"/></b>

			<!-- Parameters -->
			<xsl:text> (</xsl:text>
			<xsl:for-each select="parameters/parameter">
				<xsl:if test="@optional='true'">[</xsl:if>
				<xsl:value-of select="@name"/>
				<xsl:text>:</xsl:text>
				<i>
					<xsl:if test="datatype/array">
						<xsl:text>Array of </xsl:text>
					</xsl:if>
					<xsl:value-of select="datatype/type"/>
				</i>
				<xsl:if test="datatype/value">
					<xsl:text>=</xsl:text>
					<xsl:value-of select="datatype/type"/>
				</xsl:if>
				<xsl:if test="@optional='true'">]</xsl:if>
				<xsl:if test="position() != last()">
					<xsl:text>, </xsl:text>
				</xsl:if>
			</xsl:for-each>
			<xsl:text>)</xsl:text>
		</p>

		<xsl:apply-templates select="description | shortdesc"/>

		<xsl:if test="parameters/parameter">
			<table frame="all" rowsep="1" colsep="1" outputclass="parameterTable">
				<tgroup cols="3">
					<colspec colname="c1" colnum="1" colwidth="0.3*"/>
					<colspec colname="c2" colnum="2" colwidth="0.1*"/>
					<colspec colname="c3" colnum="3" colwidth="0.6*"/>
					<thead>
						<row>
							<entry><p>Parameter</p></entry>
							<entry><p>Type</p></entry>
							<entry><p>Description</p></entry>
						</row>
					</thead>
					<tbody>
						<xsl:apply-templates select="parameters/parameter"/>
					</tbody>
				</tgroup>
			</table>
		</xsl:if>
	</xsl:template>
	<xsl:template match="parameter">
		<row>
			<entry>
				<p><xsl:value-of select="@name"/></p>
			</entry>
			<entry>
				<xsl:apply-templates select="datatype"/>
			</entry>
			<entry>
				<xsl:apply-templates select="description | shortdesc"/>
					<xsl:if test="datatype/value">
						<p>					
							<xsl:text> (default: </xsl:text>
							<xsl:value-of select="datatype/value"/>
							<xsl:text>)</xsl:text>
						</p>
					</xsl:if>
			</entry>
		</row>
	</xsl:template>

	<xsl:template match="shortdesc | description">
		<p outputclass="description">
			<xsl:apply-templates/>
		</p>
	</xsl:template>

	<!-- Processing Types -> Link to Class -->
	<xsl:template match="datatype">
			<xsl:if test="$debug">
				<xsl:comment>
					<xsl:value-of select="."/>
				</xsl:comment>
			</xsl:if>
		<xsl:if test="not(preceding-sibling::datatype/type = type)">
			<xsl:if test="not(type='Varies' and count(following-sibling::datatype) > 0)">
				
				<xsl:for-each select="type">
					<xsl:variable name="typeName" select="."/>
					
					<xsl:if test="$typeName != 'NothingEnum'">
						<p>					
							<xsl:call-template name="generatClassLink"/>
						</p>
					</xsl:if>
							
					<!-- Resolcve Enum Values in property Table-->
					<xsl:if test="key('className', $typeName)/@enumeration = 'true'">
						<xsl:choose>
							<xsl:when test="$typeName = 'NothingEnum'">
								<p outputclass="enumInPTable">NothingEnum.NOTHING</p>
							</xsl:when>
							<xsl:when test="$typeName = 'InCopyUIColors' or $typeName = 'UIColors'">
								<!-- Do not resolve -->
							</xsl:when>
							<xsl:otherwise>
								<!--<p outputclass="enumInPTableTitle">Enumeration</p>-->
								<xsl:for-each select="key('className', $typeName)/elements[@type='class']/property">
									<p outputclass="enumInPTable">
										<xsl:value-of select="$typeName"/>
										<xsl:text>.</xsl:text>
										<xsl:value-of select="@name"/>
									</p>
								</xsl:for-each>								
							</xsl:otherwise>
						</xsl:choose>
					</xsl:if>
		
				</xsl:for-each>
			</xsl:if>
		</xsl:if>		
	</xsl:template>

	<xsl:template name="generatClassLink">
		<xsl:param name="typeName" select="."/>
		<xsl:param name="createShortcut" select="true()"/>
		
		<xsl:if test="parent::datatype/array">
			<xsl:variable name="id" select="generate-id(key('className','Array'))"/>
			<xsl:choose>
				<xsl:when test="$id">
					<xsl:variable name="ref" select="concat('Array.dita#', $id)"/>
					<xsl:element name="xref">
						<xsl:attribute name="href" select="$ref"/>
					</xsl:element>
				</xsl:when>
				<xsl:otherwise>
					<xsl:text>Array</xsl:text>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:text> of </xsl:text>
		</xsl:if>

		<!-- Link to class-->
		<xsl:call-template name="linkToClassName">
			<xsl:with-param name="typeName" select="$typeName"/>
		</xsl:call-template>

		<xsl:if test="is">
			<xsl:text> as</xsl:text>
			<xsl:value-of select="is"/>
		</xsl:if>
		
		<xsl:if test="px:isCollection($typeName) and $createShortcut">
			<xsl:variable name="shortType" select="replace(replace($typeName,'(ies$)','y'), 's$','')"/>
			<xsl:variable name="id" select="generate-id(key('className',$shortType))"/>
			<xsl:if test="$id">
				<i>
				<xsl:variable name="ref" select="concat($shortType, '.dita#', $id)"/>
				<xsl:element name="xref">
					<xsl:attribute name="href" select="$ref"/>
				</xsl:element>
				</i>
			</xsl:if>
		</xsl:if>

		<!--(range: 0 - 11)-->
		<xsl:if test="parent::datatype/min and parent::datatype/max">
			<xsl:text> (range </xsl:text>
			<xsl:value-of select="parent::datatype/min"/>
			<xsl:text> - </xsl:text>
			<xsl:value-of select="parent::datatype/max"/>
			<xsl:text>)</xsl:text>
		</xsl:if>
	</xsl:template>
	<!-- Create an xref Link to Class if possible	-->
	<xsl:template name="linkToClassName">
		<xsl:param name="typeName"/>
		<xsl:param name="writeFails" select="true()" as="xs:boolean"/>
		<xsl:param name="writeSeparator" select="false()" as="xs:boolean"/>
		<xsl:variable name="id" select="/generate-id(key('className',$typeName))"/>
		<xsl:choose>
			<xsl:when test="$id">
				<xsl:variable name="ref" select="concat($typeName,'.dita#', $id)"/>
				<xsl:element name="xref">
					<xsl:attribute name="href" select="$ref"/>
				</xsl:element>
				<xsl:if test="$writeSeparator">, </xsl:if>
			</xsl:when>
			<xsl:otherwise>
				<xsl:if test="$writeFails">
					<xsl:value-of select="$typeName"/>
				</xsl:if>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	
	<!-- Fix writing of SUI Classes -->
	<xsl:function name="px:fixSUI" as="xs:string">
		<xsl:param name="text"></xsl:param>
		<xsl:value-of select="replace($text,'SUI$',' (SUI)')"/>
	</xsl:function>
	
	<!--Check if Classname is a Collection-->
	<xsl:function name="px:isCollection" as="xs:boolean">
		<xsl:param name="typeName"/>
		<xsl:choose>
			<xsl:when test="ends-with($typeName, 's') and not(ends-with($typeName, 'preferences') or ends-with($typeName, 'options') or ends-with($typeName, 'Varies'))">
				<xsl:value-of select="true()"/>
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of select="false()"/>
			</xsl:otherwise>
		</xsl:choose>
		
	</xsl:function>

</xsl:stylesheet>
